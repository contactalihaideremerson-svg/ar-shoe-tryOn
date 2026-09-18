import * as THREE from "three";
import type { FootPose } from "../types/tracking";
import type { ShoeCalibration } from "../types/shoe";

/**
 * Converts a tracked FootPose (normalized 0..1 screen-space landmarks) into a
 * Three.js transform for the shoe model.
 *
 * LIMITATION: browsers have no reliable monocular depth sensor. We approximate
 * depth using how large the foot currently measures in the 2D frame — a
 * closer foot measures larger, so the model scales accordingly. This is a
 * practical approximation, not true depth reconstruction; it is documented
 * here per the project's "do not fake capabilities" requirement.
 *
 * Deliberately NOT used here: a fixed "assumed camera distance" constant.
 * An earlier version scaled the shoe from `pose.length / REFERENCE_DISTANCE`,
 * which only produced a correctly-sized shoe if the phone happened to be
 * held at exactly the distance that constant assumed — wrong in practice,
 * since that varies a lot by user and posture. Instead, `pose.length` (the
 * foot's measured heel-to-toe span, as a fraction of the frame) and the
 * orthographic viewport are already expressed in the same coordinate space,
 * so the foot's actual on-screen size converts directly into world units —
 * no assumed distance needed, and it stays correct as the user moves
 * closer/farther. Only `FOOT_TO_SHOE_LENGTH_RATIO` remains a constant, and
 * it's a real, near-universal one (a shoe is a fairly fixed ~5-15% longer
 * than the bare foot it fits), not a guessed viewing distance.
 */

export interface ViewportPlane {
  /** World-space width/height of the plane the orthographic camera frames, at z=0. */
  width: number;
  height: number;
  /** Whether the source video is mirrored horizontally (front camera). */
  mirrored: boolean;
}

export interface ShoeTransform {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: number;
}

/** A shoe's outsole is typically ~5-15% longer than the bare foot inside it. */
const FOOT_TO_SHOE_LENGTH_RATIO = 1.1;

export function footPoseToTransform(
  pose: FootPose,
  calibration: ShoeCalibration,
  viewport: ViewportPlane
): ShoeTransform {
  const nx = viewport.mirrored ? 1 - pose.center.x : pose.center.x;
  const ny = pose.center.y;

  const worldX = (nx - 0.5) * viewport.width;
  const worldY = (0.5 - ny) * viewport.height;

  // pose.length is the heel-to-toe span as a fraction of the frame; multiplying
  // by viewport.height converts that directly into world units of *this*
  // viewport — the same conversion worldX/worldY above already rely on — so
  // the shoe is sized from the foot's actual measured on-screen extent rather
  // than an assumed, easily-wrong viewing distance.
  const targetShoeWorldLength = pose.length * viewport.height * FOOT_TO_SHOE_LENGTH_RATIO;
  // The model is normalized (see modelLoader.normalizeModel) so its own
  // longest dimension is exactly 1, making that length directly the scale factor.
  const scale = targetShoeWorldLength * calibration.scale;

  const position = new THREE.Vector3(
    worldX + calibration.offsetX,
    worldY + calibration.offsetY,
    calibration.offsetZ
  );

  // Heading: angle from heel->toe in screen space. Mirrored feeds flip the x-axis sign.
  let heading = pose.heading;
  if (viewport.mirrored) heading = Math.PI - heading;
  // Convert from "angle from +x axis" to a rotation around Z so the shoe's forward
  // axis (assumed +Z after normalization) points toward the toe direction.
  const screenRotationZ = -(heading - Math.PI / 2);

  const euler = new THREE.Euler(
    THREE.MathUtils.degToRad(calibration.rotationX),
    THREE.MathUtils.degToRad(calibration.rotationY),
    screenRotationZ + THREE.MathUtils.degToRad(calibration.rotationZ),
    "XYZ"
  );
  const quaternion = new THREE.Quaternion().setFromEuler(euler);

  return { position, scale, quaternion };
}

/** Computes the world-space plane size an orthographic camera should frame for a given aspect ratio. */
export function computeViewportPlane(aspect: number, mirrored: boolean, baseHeight = 4): ViewportPlane {
  return { width: baseHeight * aspect, height: baseHeight, mirrored };
}
