import type { Landmark } from "../types/tracking";
import type { FootPose } from "../types/tracking";
import type { FootSide } from "../types/shoe";

/**
 * MediaPipe Pose Landmarker indices.
 *
 * 23/24 = hips
 * 25/26 = knees
 * 27/28 = ankles
 * 29/30 = heels
 * 31/32 = foot indexes / toes
 */
export const POSE_LANDMARKS = {
  LEFT_HIP: 23,
  RIGHT_HIP: 24,

  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,

  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,

  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,

  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

/**
 * Minimum visibility accepted for live tracking.
 *
 * Pose Landmarker visibility is not always reliable when the camera
 * is focused mostly on the lower body, therefore this remains
 * intentionally tolerant.
 */
export const LIVE_MIN_CONFIDENCE = 0.15;

const MIN_VISIBILITY = LIVE_MIN_CONFIDENCE;

/**
 * Reject obviously impossible normalized landmark coordinates.
 *
 * We allow a small amount outside 0..1 because later video-cover
 * geometry can legitimately move visible points outside the original
 * normalized camera frame.
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
 * MediaPipe visibility helper.
 *
 * Some model outputs/types may not contain visibility. Coordinates
 * are still useful in that case, so treat missing visibility as 1.
 */
function getVisibility(
  landmark: Landmark | undefined
): number {
  if (!landmark) return 0;

  if (
    typeof landmark.visibility === "number" &&
    Number.isFinite(landmark.visibility)
  ) {
    return Math.max(
      0,
      Math.min(1, landmark.visibility)
    );
  }

  return 1;
}

interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

function distance2D(
  a: Vec3Like,
  b: Vec3Like
): number {
  return Math.hypot(
    b.x - a.x,
    b.y - a.y
  );
}

function distance3D(
  a: Vec3Like,
  b: Vec3Like
): number {
  return Math.hypot(
    b.x - a.x,
    b.y - a.y,
    b.z - a.z
  );
}

function midpoint3(
  a: Vec3Like,
  b: Vec3Like
): Vec3Like {
  return {
    x: (a.x + b.x) * 0.5,
    y: (a.y + b.y) * 0.5,
    z: (a.z + b.z) * 0.5,
  };
}

function lerp3(
  a: Vec3Like,
  b: Vec3Like,
  t: number
): Vec3Like {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

/**
 * Build a synthetic heel only when MediaPipe does not provide
 * a usable heel landmark.
 *
 * We do NOT simply move 18% backwards anymore.
 *
 * Instead:
 *
 * ankle -> toe
 *
 * gives us the approximate foot axis, while the distance from ankle
 * to toe gives us a scale reference. The synthetic heel is placed
 * close to the ankle and slightly backwards along that axis.
 */
function reconstructHeel(
  ankle: Landmark,
  toe: Landmark
): Landmark {
  const dx = toe.x - ankle.x;
  const dy = toe.y - ankle.y;
  const dz = toe.z - ankle.z;

  const axisLength =
    Math.hypot(dx, dy) || 0.05;

  /**
   * Ankle-to-toe is normally longer than the actual heel-to-toe
   * vector. Keep the reconstructed heel close to the ankle rather
   * than pushing it too far backwards.
   */
  const extension = clamp(
    axisLength * 0.12,
    0.008,
    0.08
  );

  return {
    x:
      ankle.x -
      (dx / axisLength) * extension,

    y:
      ankle.y -
      (dy / axisLength) * extension,

    z:
      ankle.z -
      (dz / axisLength) * extension,

    visibility: Math.min(
      getVisibility(ankle),
      getVisibility(toe)
    ),
  };
}

/**
 * Computes the 2D direction of the foot from heel toward toe.
 *
 * This is deliberately based on actual visible foot landmarks,
 * rather than ankle position alone.
 */
function computeHeading(
  heel: Vec3Like,
  toe: Vec3Like
): number | null {
  const dx = toe.x - heel.x;
  const dy = toe.y - heel.y;

  const length = Math.hypot(
    dx,
    dy
  );

  if (
    !Number.isFinite(length) ||
    length < 0.003
  ) {
    return null;
  }

  return Math.atan2(
    dy,
    dx
  );
}

/**
 * Compute the usable foot length.
 *
 * 2D length is the important value for screen-space footwear fitting.
 * 3D length is used only as a sanity check because MediaPipe z is
 * relative depth, not a true metric camera-space measurement.
 */
function computeFootLength(
  heel: Vec3Like,
  toe: Vec3Like
): number {
  const length2D = distance2D(
    heel,
    toe
  );

  const length3D = distance3D(
    heel,
    toe
  );

  if (
    !Number.isFinite(length2D) ||
    length2D <= 0
  ) {
    return 0;
  }

  /**
   * MediaPipe's normalized z can become noisy when the foot rotates.
   * Therefore screen-space length remains the primary measurement.
   */
  if (
    Number.isFinite(length3D) &&
    length3D > 0
  ) {
    return length2D;
  }

  return length2D;
}

/**
 * Calculate a confidence value based on the landmarks actually
 * used to construct the foot.
 */
function computeFootConfidence(
  ankle: Landmark,
  heel: Landmark,
  toe: Landmark,
  heelWasReconstructed: boolean,
  minConfidence: number
): number {
  const ankleConfidence =
    getVisibility(ankle);

  const toeConfidence =
    getVisibility(toe);

  if (heelWasReconstructed) {
    return clamp(
      (ankleConfidence + toeConfidence) * 0.5,
      minConfidence,
      1
    );
  }

  const heelConfidence =
    getVisibility(heel);

  return clamp(
    (
      ankleConfidence +
      heelConfidence +
      toeConfidence
    ) / 3,
    minConfidence,
    1
  );
}

/**
 * Builds a stable FootPose from MediaPipe landmarks.
 *
 * IMPORTANT:
 *
 * This function only produces the foot coordinate information.
 * Video/canvas cropping and mirroring are handled later by
 * correctFootPoseForVideoGeometry().
 *
 * This separation prevents camera geometry from being mixed into
 * the raw MediaPipe landmark calculations.
 */
export function computeFootPose(
  landmarks: Landmark[],
  side: FootSide,
  hipKneeReference?: number,
  minConfidence: number = MIN_VISIBILITY
): FootPose | null {
  const ankleIndex =
    side === "left"
      ? POSE_LANDMARKS.LEFT_ANKLE
      : POSE_LANDMARKS.RIGHT_ANKLE;

  const heelIndex =
    side === "left"
      ? POSE_LANDMARKS.LEFT_HEEL
      : POSE_LANDMARKS.RIGHT_HEEL;

  const toeIndex =
    side === "left"
      ? POSE_LANDMARKS.LEFT_FOOT_INDEX
      : POSE_LANDMARKS.RIGHT_FOOT_INDEX;

  const ankle =
    landmarks[ankleIndex];

  const heel =
    landmarks[heelIndex];

  const toe =
    landmarks[toeIndex];

  /**
   * Ankle + toe are mandatory.
   *
   * Without these two points there is no reliable foot axis.
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

  if (
    ankleVisibility < minConfidence ||
    toeVisibility < minConfidence
  ) {
    return null;
  }

  /**
   * Prefer MediaPipe's actual heel.
   *
   * Only reconstruct it if the heel is missing or unreliable.
   */
  const heelVisibility =
    getVisibility(heel);

  const hasReliableHeel =
    isUsableLandmark(heel) &&
    heelVisibility >= minConfidence;

  const usableHeel =
    hasReliableHeel
      ? heel
      : reconstructHeel(
          ankle,
          toe
        );

  /**
   * Calculate the actual heel-to-toe axis.
   */
  const heading =
    computeHeading(
      usableHeel,
      toe
    );

  if (heading === null) {
    return null;
  }

  const length =
    computeFootLength(
      usableHeel,
      toe
    );

  /**
   * A normalized foot length smaller than this is almost certainly
   * landmark noise rather than a real visible foot.
   */
  if (
    !Number.isFinite(length) ||
    length < 0.008
  ) {
    return null;
  }

  /**
   * Reject extreme jumps caused by bad landmark predictions.
   *
   * Normalized camera coordinates should not produce a foot hundreds
   * of percent larger than the camera frame.
   */
  if (length > 1.25) {
    return null;
  }

  /**
   * Geometric center of the actual heel-to-toe axis.
   */
  const heelToeCenter =
    midpoint3(
      usableHeel,
      toe
    );

  /**
   * The ankle is useful for locating where the shoe should sit.
   *
   * Instead of putting the center arbitrarily between ankle and toe,
   * blend the heel-to-toe center with the ankle.
   *
   * This creates a stable mid-foot anchor while retaining the actual
   * heel/toe geometry for orientation and scale.
   */
  const center =
    lerp3(
      heelToeCenter,
      ankle,
      0.22
    );

  /**
   * Hip -> knee is only a body-scale reference.
   *
   * It must NOT control foot position because the camera may only
   * contain the lower body.
   */
  const depthScale =
    Number.isFinite(hipKneeReference) &&
    (hipKneeReference ?? 0) > 0
      ? hipKneeReference!
      : length;

  const confidence =
    computeFootConfidence(
      ankle,
      heel,
      toe,
      !hasReliableHeel,
      minConfidence
    );

  /**
   * Final numerical validation.
   */
  if (
    !Number.isFinite(center.x) ||
    !Number.isFinite(center.y) ||
    !Number.isFinite(center.z) ||
    !Number.isFinite(usableHeel.x) ||
    !Number.isFinite(usableHeel.y) ||
    !Number.isFinite(usableHeel.z) ||
    !Number.isFinite(toe.x) ||
    !Number.isFinite(toe.y) ||
    !Number.isFinite(toe.z) ||
    !Number.isFinite(heading) ||
    !Number.isFinite(length) ||
    !Number.isFinite(depthScale) ||
    !Number.isFinite(confidence)
  ) {
    return null;
  }

  return {
    side,

    center: {
      x: center.x,
      y: center.y,
      z: center.z,
    },

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
 * Hip-to-knee reference for one side.
 *
 * This is optional and must never prevent foot tracking when the
 * camera is pointed mostly at the lower body.
 */
export function computeLegReference(
  landmarks: Landmark[],
  side: FootSide
): number {
  const hipIndex =
    side === "left"
      ? POSE_LANDMARKS.LEFT_HIP
      : POSE_LANDMARKS.RIGHT_HIP;

  const kneeIndex =
    side === "left"
      ? POSE_LANDMARKS.LEFT_KNEE
      : POSE_LANDMARKS.RIGHT_KNEE;

  const hip =
    landmarks[hipIndex];

  const knee =
    landmarks[kneeIndex];

  if (
    !isUsableLandmark(hip) ||
    !isUsableLandmark(knee)
  ) {
    return 0;
  }

  const distance =
    distance2D(
      hip,
      knee
    );

  if (
    !Number.isFinite(distance) ||
    distance <= 0
  ) {
    return 0;
  }

  return distance;
}