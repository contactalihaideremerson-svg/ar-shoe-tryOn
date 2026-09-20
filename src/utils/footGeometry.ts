import type { Landmark } from "../types/tracking";
import type { FootPose } from "../types/tracking";
import type { FootSide } from "../types/shoe";

/**
 * MediaPipe Pose Landmarker indices relevant to the lower leg/foot.
 *
 * MediaPipe Pose:
 * 25/26 = knees
 * 27/28 = ankles
 * 29/30 = heels
 * 31/32 = foot indexes
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
 * Live video can be difficult for MediaPipe when the camera sees mainly
 * the feet instead of the complete body.
 *
 * Keep this deliberately lenient. Temporal smoothing in useFootTracking
 * handles small frame-to-frame fluctuations.
 */
export const LIVE_MIN_CONFIDENCE = 0.15;

const MIN_VISIBILITY = LIVE_MIN_CONFIDENCE;

/**
 * Returns whether a landmark has usable coordinates.
 *
 * MediaPipe coordinates are normalized, normally in the 0..1 range.
 * We allow a small amount outside the range because video geometry
 * correction can subsequently handle the visible crop.
 */
function isUsableLandmark(
  landmark: Landmark | undefined
): landmark is Landmark {
  if (!landmark) return false;

  return (
    Number.isFinite(landmark.x) &&
    Number.isFinite(landmark.y) &&
    Number.isFinite(landmark.z)
  );
}

/**
 * Gets MediaPipe visibility.
 *
 * Some pipelines/types may omit visibility. In that case the landmark
 * coordinates themselves are still usable, so use a neutral confidence
 * rather than automatically treating the landmark as invisible.
 */
function getVisibility(
  landmark: Landmark | undefined
): number {
  if (!landmark) return 0;

  if (
    typeof landmark.visibility === "number" &&
    Number.isFinite(landmark.visibility)
  ) {
    return landmark.visibility;
  }

  return 1;
}

function lerp3(
  a: Landmark,
  b: Landmark,
  t: number
) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function dist2D(
  a: { x: number; y: number },
  b: { x: number; y: number }
) {
  return Math.hypot(
    a.x - b.x,
    a.y - b.y
  );
}

/**
 * Creates a synthetic midpoint between two landmarks.
 *
 * Used only when MediaPipe does not provide a sufficiently visible
 * heel landmark.
 */
function midpoint(
  a: Landmark,
  b: Landmark
): Landmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    visibility: Math.min(
      getVisibility(a),
      getVisibility(b)
    ),
  };
}

/**
 * Builds a meaningful FootPose from raw MediaPipe pose landmarks.
 *
 * The original implementation required ankle + heel + toe to all pass
 * the same visibility threshold. That is too strict for live footwear
 * try-on because a user can show only the lower leg/foot to the camera.
 *
 * This version:
 *   1. Requires usable ankle/toe information.
 *   2. Accepts a lower-confidence heel when necessary.
 *   3. Uses ankle/toe geometry to reconstruct a usable heel/midfoot.
 *   4. Keeps the confidence value so the rest of the tracking pipeline
 *      can still distinguish strong and weak detections.
 */
export function computeFootPose(
  landmarks: Landmark[],
  side: FootSide,
  hipKneeReference?: number,
  minConfidence: number = MIN_VISIBILITY
): FootPose | null {
  const ankleIdx =
    side === "left"
      ? POSE_LANDMARKS.LEFT_ANKLE
      : POSE_LANDMARKS.RIGHT_ANKLE;

  const heelIdx =
    side === "left"
      ? POSE_LANDMARKS.LEFT_HEEL
      : POSE_LANDMARKS.RIGHT_HEEL;

  const toeIdx =
    side === "left"
      ? POSE_LANDMARKS.LEFT_FOOT_INDEX
      : POSE_LANDMARKS.RIGHT_FOOT_INDEX;

  const ankle = landmarks[ankleIdx];
  const heel = landmarks[heelIdx];
  const toe = landmarks[toeIdx];

  /*
   * Ankle and toe are the two most useful points for determining
   * whether a visible lower limb is actually a foot.
   */
  if (
    !isUsableLandmark(ankle) ||
    !isUsableLandmark(toe)
  ) {
    return null;
  }

  const ankleVisibility =
    getVisibility(ankle);

  const toeVisibility =
    getVisibility(toe);

  /*
   * Both ankle and toe need at least a minimal amount of confidence.
   * This is intentionally lower than the old 0.3 threshold because
   * feet-only camera framing is harder for the full-body Pose model.
   */
  if (
    ankleVisibility < minConfidence ||
    toeVisibility < minConfidence
  ) {
    return null;
  }

  /*
   * Heel can sometimes have very low visibility even when ankle and
   * toe are usable. In that case reconstruct an approximate heel by
   * extending the ankle away from the toe.
   */
  let usableHeel: Landmark;

  const heelVisibility =
    getVisibility(heel);

  if (
    isUsableLandmark(heel) &&
    heelVisibility >= minConfidence
  ) {
    usableHeel = heel;
  } else {
    /*
     * The ankle is naturally close to the heel.
     * Move slightly backwards from ankle along the ankle->toe vector.
     */
    const dx = toe.x - ankle.x;
    const dy = toe.y - ankle.y;
    const dz = toe.z - ankle.z;

    const footDirectionLength =
      Math.hypot(dx, dy) || 0.05;

    const extension =
      footDirectionLength * 0.18;

    usableHeel = {
      x: ankle.x - (dx / footDirectionLength) * extension,
      y: ankle.y - (dy / footDirectionLength) * extension,
      z: ankle.z - (dz / footDirectionLength) * extension,
      visibility: Math.min(
        ankleVisibility,
        toeVisibility
      ),
    };
  }

  /*
   * Foot center is between heel and toe, slightly biased toward
   * the ankle/midfoot area.
   */
  const heelToToe = lerp3(
    usableHeel,
    toe,
    0.5
  );

  const center = lerp3(
    heelToToe,
    ankle,
    0.25
  );

  /*
   * Direction from heel to toe.
   *
   * The existing video-geometry correction handles mirroring/cropping
   * later in the tracking pipeline, so do not flip x here.
   */
  const heading = Math.atan2(
    toe.y - usableHeel.y,
    toe.x - usableHeel.x
  );

  const length =
    dist2D(
      usableHeel,
      toe
    ) || 0.05;

  /*
   * Hip->knee gives us a body-scale reference when available.
   * For feet-only framing this may not be visible, so fall back to
   * actual foot length.
   */
  const depthScale =
    hipKneeReference &&
    hipKneeReference > 0
      ? hipKneeReference
      : length;

  /*
   * Average confidence from the landmarks actually used.
   *
   * If heel was reconstructed, use ankle/toe rather than penalizing
   * the detection for a missing heel.
   */
  const confidence =
    isUsableLandmark(heel) &&
    heelVisibility >= minConfidence
      ? (ankleVisibility +
          heelVisibility +
          toeVisibility) /
        3
      : (ankleVisibility +
          toeVisibility) /
        2;

  /*
   * Final guard against invalid numerical output.
   */
  if (
    !Number.isFinite(center.x) ||
    !Number.isFinite(center.y) ||
    !Number.isFinite(center.z) ||
    !Number.isFinite(heading) ||
    !Number.isFinite(length) ||
    length <= 0
  ) {
    return null;
  }

  return {
    side,
    center,

    ankle: {
      x: ankle.x,
      y: ankle.y,
      z: ankle.z,
    },

    heel: {
      x: usableHeel.x,
      y: usableHeel.y,
      z: usableHeel.z,
    },

    toe: {
      x: toe.x,
      y: toe.y,
      z: toe.z,
    },

    heading,
    length,
    confidence,
    depthScale,
  };
}

/**
 * Hip-to-knee distance for one side.
 *
 * This is optional. Foot tracking must still work when the camera only
 * sees the lower leg/foot and the hip is outside the frame.
 */
export function computeLegReference(
  landmarks: Landmark[],
  side: FootSide
): number {
  const hipIdx =
    side === "left"
      ? POSE_LANDMARKS.LEFT_HIP
      : POSE_LANDMARKS.RIGHT_HIP;

  const kneeIdx =
    side === "left"
      ? POSE_LANDMARKS.LEFT_KNEE
      : POSE_LANDMARKS.RIGHT_KNEE;

  const hip = landmarks[hipIdx];
  const knee = landmarks[kneeIdx];

  if (
    !isUsableLandmark(hip) ||
    !isUsableLandmark(knee)
  ) {
    return 0;
  }

  return dist2D(
    hip,
    knee
  );
}