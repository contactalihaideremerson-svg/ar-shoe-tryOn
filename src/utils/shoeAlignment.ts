import * as THREE from "three";
import type { FootPose } from "../types/tracking";
import type { ShoeCalibration } from "../types/shoe";

/**
 * Describes the relationship between the camera/video frame and the
 * actual on-screen camera container.
 */
export interface VideoGeometry {
  videoWidth: number;
  videoHeight: number;

  containerWidth: number;
  containerHeight: number;

  /**
   * true when the displayed front-camera video is CSS mirrored.
   */
  mirrored: boolean;
}

export interface PixelPoint {
  x: number;
  y: number;
}

/**
 * Validate camera/container geometry before doing coordinate conversion.
 */
function hasValidGeometry(
  geo: VideoGeometry
): boolean {
  return (
    Number.isFinite(geo.videoWidth) &&
    Number.isFinite(geo.videoHeight) &&
    Number.isFinite(geo.containerWidth) &&
    Number.isFinite(geo.containerHeight) &&
    geo.videoWidth > 0 &&
    geo.videoHeight > 0 &&
    geo.containerWidth > 0 &&
    geo.containerHeight > 0
  );
}

/**
 * Convert normalized MediaPipe coordinates into actual screen/container
 * coordinates.
 *
 * MediaPipe:
 *   x = 0..1 left → right
 *   y = 0..1 top → bottom
 *
 * Camera:
 *   object-fit: cover
 *
 * Therefore the displayed video may be cropped on either axis.
 */
export function mapVideoPointToContainer(
  nx: number,
  ny: number,
  geo: VideoGeometry
): PixelPoint {
  const safeX = Number.isFinite(nx) ? nx : 0.5;
  const safeY = Number.isFinite(ny) ? ny : 0.5;

  /**
   * MediaPipe sees the original camera frame.
   *
   * The CSS front-camera preview is mirrored, so convert the x
   * coordinate before applying the cover crop.
   */
  const mappedX = geo.mirrored
    ? 1 - safeX
    : safeX;

  if (!hasValidGeometry(geo)) {
    return {
      x: mappedX * Math.max(geo.containerWidth, 1),
      y: safeY * Math.max(geo.containerHeight, 1),
    };
  }

  /**
   * Equivalent to CSS:
   *
   * object-fit: cover
   */
  const scale = Math.max(
    geo.containerWidth / geo.videoWidth,
    geo.containerHeight / geo.videoHeight
  );

  const displayedWidth =
    geo.videoWidth * scale;

  const displayedHeight =
    geo.videoHeight * scale;

  /**
   * Amount cropped away from the displayed video.
   */
  const cropX =
    (displayedWidth -
      geo.containerWidth) /
    2;

  const cropY =
    (displayedHeight -
      geo.containerHeight) /
    2;

  return {
    x:
      mappedX *
        displayedWidth -
      cropX,

    y:
      safeY *
        displayedHeight -
      cropY,
  };
}

/**
 * Debug helper.
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

  const scale = Math.max(
    geo.containerWidth / geo.videoWidth,
    geo.containerHeight / geo.videoHeight
  );

  return {
    cropX:
      (geo.videoWidth * scale -
        geo.containerWidth) /
      2,

    cropY:
      (geo.videoHeight * scale -
        geo.containerHeight) /
      2,
  };
}

/**
 * Convert a raw MediaPipe FootPose into coordinates relative to the
 * visible camera container.
 *
 * This MUST happen before the final 3D shoe transform.
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

  const width =
    Math.max(
      geo.containerWidth,
      1
    );

  const height =
    Math.max(
      geo.containerHeight,
      1
    );

  /**
   * The actual projected foot axis on the screen.
   */
  const dx =
    toePx.x -
    heelPx.x;

  const dy =
    toePx.y -
    heelPx.y;

  const projectedLength =
    Math.hypot(dx, dy);

  /**
   * Never allow zero-length geometry to create NaN rotations.
   */
  const safeLength =
    Number.isFinite(projectedLength) &&
    projectedLength > 0.5
      ? projectedLength
      : height * 0.05;

  const heading =
    Math.atan2(
      dy,
      dx
    );

  return {
    ...pose,

    center: {
      x:
        centerPx.x /
        width,

      y:
        centerPx.y /
        height,

      z: pose.center.z,
    },

    heel: {
      x:
        heelPx.x /
        width,

      y:
        heelPx.y /
        height,

      z: pose.heel.z,
    },

    toe: {
      x:
        toePx.x /
        width,

      y:
        toePx.y /
        height,

      z: pose.toe.z,
    },

    ankle: {
      x:
        anklePx.x /
        width,

      y:
        anklePx.y /
        height,

      z: pose.ankle.z,
    },

    /**
     * Keep length in relation to the visible container height.
     */
    length:
      safeLength /
      height,

    heading,
  };
}

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
 * ---------------------------------------------------------------
 * FOOTWEAR CALIBRATION CONSTANTS
 * ---------------------------------------------------------------
 */

/**
 * A shoe normally extends slightly beyond the detected heel/toe
 * landmarks.
 *
 * This is intentionally conservative. Individual products can
 * override the result through ShoeCalibration.scale.
 */
const FOOT_TO_SHOE_LENGTH_RATIO = 1.0;

/**
 * Location of the 3D model's visual center along the heel → toe axis.
 *
 * 0   = heel
 * 0.5 = middle of foot
 * 1   = toe
 *
 * Most centered GLB models should use approximately 0.5.
 */
const SHOE_ANCHOR_ALONG_FOOT = 0.5;

/**
 * Protect the renderer from broken calibration values.
 */
const MIN_CALIBRATION_SCALE = 0.25;
const MAX_CALIBRATION_SCALE = 4;

/**
 * Protect against extremely tiny/huge projected foot measurements.
 */
const MIN_FOOT_LENGTH = 0.01;
const MAX_FOOT_LENGTH = 1.2;

/**
 * Convert a tracked foot into a 3D shoe transform.
 *
 * Coordinate system:
 *
 * Camera:
 *   x → right
 *   y → down
 *
 * Three.js orthographic plane:
 *   x → right
 *   y → up
 *
 * Therefore Y must be inverted when moving from screen to Three.js.
 */
export function footPoseToTransform(
  pose: FootPose,
  calibration: ShoeCalibration,
  viewport: ViewportPlane
): ShoeTransform {
  /**
   * ---------------------------------------------------------------
   * 1. VALIDATE FOOT GEOMETRY
   * ---------------------------------------------------------------
   */

  const safeViewportWidth =
    Number.isFinite(viewport.width) &&
    viewport.width > 0
      ? viewport.width
      : 1;

  const safeViewportHeight =
    Number.isFinite(viewport.height) &&
    viewport.height > 0
      ? viewport.height
      : 1;

  const rawLength =
    Number.isFinite(pose.length) &&
    pose.length > 0
      ? pose.length
      : 0.05;

  const footLength =
    THREE.MathUtils.clamp(
      rawLength,
      MIN_FOOT_LENGTH,
      MAX_FOOT_LENGTH
    );

  /**
   * ---------------------------------------------------------------
   * 2. BUILD THE SCREEN-SPACE FOOT AXIS
   * ---------------------------------------------------------------
   *
   * heel → toe
   *
   * This is the most important line in the entire alignment system.
   *
   * Position, rotation and scale are all derived from this geometry.
   */

  const heelX =
    Number.isFinite(pose.heel.x)
      ? pose.heel.x
      : pose.center.x;

  const heelY =
    Number.isFinite(pose.heel.y)
      ? pose.heel.y
      : pose.center.y;

  const toeX =
    Number.isFinite(pose.toe.x)
      ? pose.toe.x
      : pose.center.x;

  const toeY =
    Number.isFinite(pose.toe.y)
      ? pose.toe.y
      : pose.center.y;

  let axisX =
    toeX -
    heelX;

  let axisY =
    toeY -
    heelY;

  const axisLength =
    Math.hypot(
      axisX,
      axisY
    );

  if (
    !Number.isFinite(axisLength) ||
    axisLength < 0.00001
  ) {
    axisX = 1;
    axisY = 0;
  } else {
    axisX /= axisLength;
    axisY /= axisLength;
  }

  /**
   * ---------------------------------------------------------------
   * 3. FIND EXACT SHOE ANCHOR ON THE FOOT
   * ---------------------------------------------------------------
   *
   * Instead of taking the ankle as the shoe center, calculate a point
   * directly on the heel → toe axis.
   *
   * This means the shoe remains attached to the foot when the foot
   * moves, rotates or changes direction.
   */

  const anchorX =
    heelX +
    (toeX - heelX) *
      SHOE_ANCHOR_ALONG_FOOT;

  const anchorY =
    heelY +
    (toeY - heelY) *
      SHOE_ANCHOR_ALONG_FOOT;

  /**
   * Calibration offsets are expressed in Three.js world units,
   * so they are added after the camera-space conversion.
   */
  const normalizedX =
    THREE.MathUtils.clamp(
      anchorX,
      0,
      1
    );

  const normalizedY =
    THREE.MathUtils.clamp(
      anchorY,
      0,
      1
    );

  /**
   * Screen → Three.js.
   */
  const worldX =
    (normalizedX - 0.5) *
    safeViewportWidth;

  const worldY =
    (0.5 - normalizedY) *
    safeViewportHeight;

  /**
   * ---------------------------------------------------------------
   * 4. FOOT LENGTH → SHOE SIZE
   * ---------------------------------------------------------------
   *
   * Because FootPose.length is normalized relative to the visible
   * camera container height, multiplying by viewport.height converts
   * it into the same world-space coordinate system used by the
   * orthographic camera.
   */

  const footWorldLength =
    footLength *
    safeViewportHeight;

  const targetShoeLength =
    footWorldLength *
    FOOT_TO_SHOE_LENGTH_RATIO;

  /**
   * Individual shoe calibration.
   */
  const rawCalibrationScale =
    Number.isFinite(
      calibration.scale
    ) &&
    calibration.scale > 0
      ? calibration.scale
      : 1;

  const calibrationScale =
    THREE.MathUtils.clamp(
      rawCalibrationScale,
      MIN_CALIBRATION_SCALE,
      MAX_CALIBRATION_SCALE
    );

  const finalScale =
    targetShoeLength *
    calibrationScale;

  /**
   * ---------------------------------------------------------------
   * 5. FOOT ROTATION
   * ---------------------------------------------------------------
   *
   * pose.heading is the actual heel → toe angle on screen.
   *
   * Three.js's XY plane uses:
   *
   *   +X = right
   *   +Y = up
   *
   * The shoe's conventional forward direction is treated as +Y
   * on the screen plane.
   *
   * Therefore:
   *
   * screenAngle - PI/2
   *
   * maps the foot axis into the Three.js XY plane.
   */

  const screenRotationZ =
    pose.heading -
    Math.PI / 2;

  const rotationX =
    THREE.MathUtils.degToRad(
      Number.isFinite(
        calibration.rotationX
      )
        ? calibration.rotationX
        : 0
    );

  const rotationY =
    THREE.MathUtils.degToRad(
      Number.isFinite(
        calibration.rotationY
      )
        ? calibration.rotationY
        : 0
    );

  const rotationZ =
    screenRotationZ +
    THREE.MathUtils.degToRad(
      Number.isFinite(
        calibration.rotationZ
      )
        ? calibration.rotationZ
        : 0
    );

  const quaternion =
    new THREE.Quaternion();

  quaternion.setFromEuler(
    new THREE.Euler(
      rotationX,
      rotationY,
      rotationZ,
      "XYZ"
    )
  );

  /**
   * ---------------------------------------------------------------
   * 6. FINAL POSITION
   * ---------------------------------------------------------------
   *
   * Automatic foot tracking is calculated first.
   * Manual calibration offsets are applied afterwards.
   */

  const offsetX =
    Number.isFinite(
      calibration.offsetX
    )
      ? calibration.offsetX
      : 0;

  const offsetY =
    Number.isFinite(
      calibration.offsetY
    )
      ? calibration.offsetY
      : 0;

  const offsetZ =
    Number.isFinite(
      calibration.offsetZ
    )
      ? calibration.offsetZ
      : 0;

  const position =
    new THREE.Vector3(
      worldX + offsetX,
      worldY + offsetY,
      offsetZ
    );

  return {
    position,
    quaternion,
    scale: Math.max(
      finalScale,
      0.0001
    ),
  };
}

/**
 * Calculate the Three.js orthographic plane that matches the actual
 * camera container.
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

  const safeHeight =
    Number.isFinite(baseHeight) &&
    baseHeight > 0
      ? baseHeight
      : 4;

  return {
    width:
      safeHeight *
      safeAspect,

    height:
      safeHeight,
  };
}