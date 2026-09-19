import type { Landmark } from "../types/tracking";
import type { FootPose } from "../types/tracking";
import type { FootSide } from "../types/shoe";

/**
 * MediaPipe Pose Landmarker indices relevant to the lower leg/foot.
 * There is no dedicated browser "foot landmarker" model in general availability,
 * so we use the full-body Pose Landmarker and read its foot-specific keypoints
 * (ankle, heel, foot index/toe). This is the most accurate browser-based
 * approach currently available without a server-side model.
 */
export const POSE_LANDMARKS = {
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
} as const;

/**
 * Live tracking's default confidence bar. Temporal smoothing across many
 * frames absorbs an occasional shaky detection, so this can stay lower than
 * photo mode's one-shot threshold. Kept as an exported, named constant
 * (rather than inlined) so it's a single, obvious place to retune during
 * real-device testing instead of a magic number buried in a function body.
 */
export const LIVE_MIN_CONFIDENCE = 0.3;
const MIN_VISIBILITY = LIVE_MIN_CONFIDENCE;

function lerp3(a: Landmark, b: Landmark, t: number) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

function dist2D(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Builds a meaningful FootPose (center/orientation/scale/confidence) from raw pose landmarks.
 * `minConfidence` defaults to a lenient bar suited to live video, where temporal smoothing
 * across many frames absorbs an occasional shaky one. A single still photo gets no such
 * safety net, so callers with one shot at detection (see usePhotoFootDetection) should pass
 * a stricter value — otherwise a marginal, low-confidence guess (e.g. from a photo with no
 * torso/head for the pose model to anchor on) renders a confidently-wrong shoe instead of
 * the "couldn't detect your feet" fallback.
 */
export function computeFootPose(
  landmarks: Landmark[],
  side: FootSide,
  hipKneeReference?: number,
  minConfidence: number = MIN_VISIBILITY
): FootPose | null {
  const ankleIdx = side === "left" ? POSE_LANDMARKS.LEFT_ANKLE : POSE_LANDMARKS.RIGHT_ANKLE;
  const heelIdx = side === "left" ? POSE_LANDMARKS.LEFT_HEEL : POSE_LANDMARKS.RIGHT_HEEL;
  const toeIdx = side === "left" ? POSE_LANDMARKS.LEFT_FOOT_INDEX : POSE_LANDMARKS.RIGHT_FOOT_INDEX;

  const ankle = landmarks[ankleIdx];
  const heel = landmarks[heelIdx];
  const toe = landmarks[toeIdx];
  if (!ankle || !heel || !toe) return null;

  const visibilities = [ankle.visibility ?? 0, heel.visibility ?? 0, toe.visibility ?? 0];
  const confidence = visibilities.reduce((a, b) => a + b, 0) / 3;
  if (confidence < minConfidence) return null;

  // Foot center: weighted toward the midfoot between heel and toe, anchored by ankle height.
  const heelToToe = lerp3(heel, toe, 0.5);
  const center = lerp3(heelToToe, ankle, 0.25);

  // Heading: direction from heel to toe in screen space (x flipped because mirrored video).
  const heading = Math.atan2(toe.y - heel.y, toe.x - heel.x);

  const length = dist2D(heel, toe) || 0.05;

  // Depth scale proxy: use hip->knee distance if available for a body-scale-invariant measure,
  // otherwise fall back to foot length itself.
  const depthScale = hipKneeReference && hipKneeReference > 0 ? hipKneeReference : length;

  return {
    side,
    center,
    ankle: { x: ankle.x, y: ankle.y, z: ankle.z },
    heel: { x: heel.x, y: heel.y, z: heel.z },
    toe: { x: toe.x, y: toe.y, z: toe.z },
    heading,
    length,
    confidence,
    depthScale,
  };
}

/** Hip-to-knee distance for one side, used as a body-scale reference for depth estimation. */
export function computeLegReference(landmarks: Landmark[], side: FootSide): number {
  const hipIdx = side === "left" ? POSE_LANDMARKS.LEFT_HIP : POSE_LANDMARKS.RIGHT_HIP;
  const kneeIdx = side === "left" ? POSE_LANDMARKS.LEFT_KNEE : POSE_LANDMARKS.RIGHT_KNEE;
  const hip = landmarks[hipIdx];
  const knee = landmarks[kneeIdx];
  if (!hip || !knee) return 0;
  return dist2D(hip, knee);
}
