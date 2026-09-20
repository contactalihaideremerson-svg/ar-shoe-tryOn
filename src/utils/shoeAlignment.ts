import * as THREE from "three";
import type { FootPose } from "../types/tracking";
import type { ShoeCalibration } from "../types/shoe";

/**
 * Describes the geometric relationship between the raw video/image frame
 * MediaPipe measured landmarks against and the on-screen container it's
 * actually displayed in.
 */
export interface VideoGeometry {
  /** Intrinsic pixel size of the video/image MediaPipe's normalized coordinates are relative to. */
  videoWidth: number;
  videoHeight: number;

  /** Actual on-screen size of the container. */
  containerWidth: number;
  containerHeight: number;

  /** Whether the displayed video is CSS-mirrored. */
  mirrored: boolean;
}

export interface PixelPoint {
  x: number;
  y: number;
}

function hasValidGeometry(
  geo: VideoGeometry
): boolean {
  return (
    geo.videoWidth > 0 &&
    geo.videoHeight > 0 &&
    geo.containerWidth > 0 &&
    geo.containerHeight > 0
  );
}

/**
 * Convert normalized MediaPipe coordinates into the actual visible
 * camera container.
 *
 * This accounts for:
 * - object-fit: cover
 * - video/container aspect-ratio difference
 * - front-camera mirroring
 */
export function mapVideoPointToContainer(
  nx: number,
  ny: number,
  geo: VideoGeometry
): PixelPoint {
  const mx = geo.mirrored ? 1 - nx : nx;

  if (!hasValidGeometry(geo)) {
    return {
      x: mx * geo.containerWidth,
      y: ny * geo.containerHeight,
    };
  }

  const coverScale = Math.max(
    geo.containerWidth / geo.videoWidth,
    geo.containerHeight / geo.videoHeight
  );

  const displayedWidth =
    geo.videoWidth * coverScale;

  const displayedHeight =
    geo.videoHeight * coverScale;

  const cropX =
    (displayedWidth -
      geo.containerWidth) /
    2;

  const cropY =
    (displayedHeight -
      geo.containerHeight) /
    2;

  return {
    x: mx * displayedWidth - cropX,
    y: ny * displayedHeight - cropY,
  };
}

/**
 * Debug-only helper showing how much of the raw video is cropped.
 */
export function computeCoverCrop(
  geo: VideoGeometry
): {
  cropX: number;
  cropY: number;
} {
  if (!hasValidGeometry(geo)) {
    return {
      cropX: 0,
      cropY: 0,
    };
  }

  const coverScale = Math.max(
    geo.containerWidth / geo.videoWidth,
    geo.containerHeight / geo.videoHeight
  );

  return {
    cropX:
      (geo.videoWidth * coverScale -
        geo.containerWidth) /
      2,

    cropY:
      (geo.videoHeight * coverScale -
        geo.containerHeight) /
      2,
  };
}

/**
 * Re-express raw MediaPipe FootPose coordinates in the visible
 * camera container.
 */
export function correctFootPoseForVideoGeometry(
  pose: FootPose,
  geo: VideoGeometry
): FootPose {
  const centerPx =
    mapVideoPointToContainer(
      pose.center.x,
      pose.center.y,
      geo
    );

  const heelPx =
    mapVideoPointToContainer(
      pose.heel.x,
      pose.heel.y,
      geo
    );

  const toePx =
    mapVideoPointToContainer(
      pose.toe.x,
      pose.toe.y,
      geo
    );

  const anklePx =
    mapVideoPointToContainer(
      pose.ankle.x,
      pose.ankle.y,
      geo
    );

  const cw =
    geo.containerWidth || 1;

  const ch =
    geo.containerHeight || 1;

  const lengthPx =
    Math.hypot(
      toePx.x - heelPx.x,
      toePx.y - heelPx.y
    ) || 0.05 * ch;

  const heading =
    Math.atan2(
      toePx.y - heelPx.y,
      toePx.x - heelPx.x
    );

  return {
    ...pose,

    center: {
      x: centerPx.x / cw,
      y: centerPx.y / ch,
      z: pose.center.z,
    },

    heel: {
      x: heelPx.x / cw,
      y: heelPx.y / ch,
      z: pose.heel.z,
    },

    toe: {
      x: toePx.x / cw,
      y: toePx.y / ch,
      z: pose.toe.z,
    },

    ankle: {
      x: anklePx.x / cw,
      y: anklePx.y / ch,
      z: pose.ankle.z,
    },

    length: lengthPx / ch,
    heading,
  };
}

/**
 * World-space plane represented by the orthographic camera.
 */
export interface ViewportPlane {
  width: number;
  height: number;
}

export interface ShoeTransform {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: number;
}

/**
 * A shoe is generally only slightly longer than the foot inside it.
 *
 * We deliberately use a conservative ratio here because the previous
 * 1.1 value produced an oversized model on the tested mobile camera.
 */
const FOOT_TO_SHOE_LENGTH_RATIO = 0.78;

/**
 * Small vertical adjustment.
 *
 * The pose center is calculated around the mid-foot/ankle region.
 * Move the rendered shoe slightly toward the toes so the shoe's visual
 * center sits naturally over the foot.
 */
const SHOE_CENTER_TO_TOE_OFFSET = 0.08;

/**
 * Prevent an accidental extreme calibration value from making the
 * live model effectively invisible or enormous.
 *
 * Normal calibration values remain untouched.
 */
const MIN_CALIBRATION_SCALE = 0.35;
const MAX_CALIBRATION_SCALE = 2.5;

/**
 * Converts a tracked FootPose into a Three.js transform.
 *
 * Input pose is expected to already be corrected for:
 * - object-fit: cover
 * - container dimensions
 * - front-camera mirroring
 */
export function footPoseToTransform(
  pose: FootPose,
  calibration: ShoeCalibration,
  viewport: ViewportPlane
): ShoeTransform {
  /**
   * ---------------------------------------------------------
   * 1. FOOT POSITION → WORLD POSITION
   * ---------------------------------------------------------
   *
   * MediaPipe/container coordinates:
   *   x: 0 = left, 1 = right
   *   y: 0 = top, 1 = bottom
   *
   * Three.js orthographic world:
   *   x: -width/2 = left
   *   x: +width/2 = right
   *   y: +height/2 = top
   *   y: -height/2 = bottom
   */
  let normalizedX =
    THREE.MathUtils.clamp(
      pose.center.x,
      0,
      1
    );

  let normalizedY =
    THREE.MathUtils.clamp(
      pose.center.y,
      0,
      1
    );

  /**
   * Move the visual shoe center slightly toward the toe.
   *
   * This is based on the heel → toe direction rather than simply
   * shifting vertically, so it also behaves correctly when the foot
   * is rotated inside the camera frame.
   */
  const toeDirection = new THREE.Vector2(
    pose.toe.x - pose.heel.x,
    pose.toe.y - pose.heel.y
  );

  if (toeDirection.lengthSq() > 0.000001) {
    toeDirection.normalize();

    normalizedX +=
      toeDirection.x *
      pose.length *
      SHOE_CENTER_TO_TOE_OFFSET;

    normalizedY +=
      toeDirection.y *
      pose.length *
      SHOE_CENTER_TO_TOE_OFFSET;
  }

  normalizedX =
    THREE.MathUtils.clamp(
      normalizedX,
      0,
      1
    );

  normalizedY =
    THREE.MathUtils.clamp(
      normalizedY,
      0,
      1
    );

  const worldX =
    (normalizedX - 0.5) *
    viewport.width;

  const worldY =
    (0.5 - normalizedY) *
    viewport.height;

  /**
   * ---------------------------------------------------------
   * 2. FOOT LENGTH → SHOE SCALE
   * ---------------------------------------------------------
   *
   * pose.length is expressed as a fraction of the visible
   * container height.
   *
   * Convert it into Three.js world units using viewport.height.
   */
  const safeFootLength =
    Number.isFinite(pose.length) &&
    pose.length > 0.001
      ? pose.length
      : 0.05;

  const footWorldLength =
    safeFootLength *
    viewport.height;

  /**
   * The previous ratio made the test model considerably larger
   * than the actual foot. Use a conservative physical ratio.
   */
  const targetShoeWorldLength =
    footWorldLength *
    FOOT_TO_SHOE_LENGTH_RATIO;

  /**
   * Respect per-shoe calibration but protect against accidental
   * extreme values.
   */
  const rawCalibrationScale =
    Number.isFinite(
      calibration.scale
    ) &&
    calibration.scale > 0
      ? calibration.scale
      : 1;

  const safeCalibrationScale =
    THREE.MathUtils.clamp(
      rawCalibrationScale,
      MIN_CALIBRATION_SCALE,
      MAX_CALIBRATION_SCALE
    );

  const scale =
    targetShoeWorldLength *
    safeCalibrationScale;

  /**
   * ---------------------------------------------------------
   * 3. ROTATION
   * ---------------------------------------------------------
   *
   * MediaPipe heading is the angle from heel → toe in screen space.
   *
   * The shoe model's forward axis is assumed to be +Z after
   * normalization.
   */
  const screenRotationZ =
    -(pose.heading - Math.PI / 2);

  const euler =
    new THREE.Euler(
      THREE.MathUtils.degToRad(
        calibration.rotationX
      ),

      THREE.MathUtils.degToRad(
        calibration.rotationY
      ),

      screenRotationZ +
        THREE.MathUtils.degToRad(
          calibration.rotationZ
        ),

      "XYZ"
    );

  const quaternion =
    new THREE.Quaternion().setFromEuler(
      euler
    );

  /**
   * ---------------------------------------------------------
   * 4. FINAL POSITION
   * ---------------------------------------------------------
   *
   * Calibration offsets are applied after automatic tracking.
   */
  const position =
    new THREE.Vector3(
      worldX + calibration.offsetX,
      worldY + calibration.offsetY,
      calibration.offsetZ
    );

  return {
    position,
    quaternion,
    scale,
  };
}

/**
 * Computes the world-space plane represented by the orthographic camera.
 *
 * The aspect must be the actual on-screen container aspect ratio.
 */
export function computeViewportPlane(
  aspect: number,
  baseHeight = 4
): ViewportPlane {
  const safeAspect =
    Number.isFinite(aspect) &&
    aspect > 0
      ? aspect
      : 1;

  return {
    width:
      baseHeight * safeAspect,
    height: baseHeight,
  };
}