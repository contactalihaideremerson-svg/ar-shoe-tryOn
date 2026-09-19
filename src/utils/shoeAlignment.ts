import * as THREE from "three";
import type { FootPose } from "../types/tracking";
import type { ShoeCalibration } from "../types/shoe";

/**
 * Describes the geometric relationship between the raw video/image frame
 * MediaPipe measured landmarks against and the on-screen container it's
 * actually displayed in. These two are NOT the same rectangle whenever the
 * container uses `object-fit: cover` (the live camera view always does, to
 * fill the screen edge-to-edge) and the video's own aspect ratio doesn't
 * exactly match the container's — extremely common on real phones, where the
 * camera's native capture resolution rarely matches the screen. Photo mode
 * sidesteps this by sizing its container to exactly match the photo's aspect
 * ratio (see TryOnCanvas), so `containerWidth/Height` there just equal the
 * image's own dimensions and this degenerates to an identity mapping.
 */
export interface VideoGeometry {
  /** Intrinsic pixel size of the video/image MediaPipe's normalized coordinates are relative to. */
  videoWidth: number;
  videoHeight: number;
  /** Actual on-screen size (CSS pixels) of the element the video is displayed inside via object-fit: cover. */
  containerWidth: number;
  containerHeight: number;
  /** Whether the displayed video is CSS-mirrored (front camera) — MediaPipe always sees the raw, unmirrored frame. */
  mirrored: boolean;
}

export interface PixelPoint {
  x: number;
  y: number;
}

function hasValidGeometry(geo: VideoGeometry): boolean {
  return geo.videoWidth > 0 && geo.videoHeight > 0 && geo.containerWidth > 0 && geo.containerHeight > 0;
}

/**
 * The ONE place normalized MediaPipe coordinates (0..1, relative to the raw
 * video/image frame) get converted into actual on-screen container pixels.
 * Accounts for the `object-fit: cover` crop and for CSS mirroring — nowhere
 * else should reimplement this with its own ad-hoc x*width / y*height math
 * (that was the root cause of the shoe rendering far from the real foot: it
 * silently assumed the video frame and the container were the same
 * rectangle, which is only true by coincidence).
 */
export function mapVideoPointToContainer(nx: number, ny: number, geo: VideoGeometry): PixelPoint {
  const mx = geo.mirrored ? 1 - nx : nx;
  if (!hasValidGeometry(geo)) {
    // No layout measured yet — fall back to a direct (uncropped) mapping
    // rather than dividing by zero; corrected on the next frame once real
    // dimensions are available.
    return { x: mx * geo.containerWidth, y: ny * geo.containerHeight };
  }
  const coverScale = Math.max(geo.containerWidth / geo.videoWidth, geo.containerHeight / geo.videoHeight);
  const displayedWidth = geo.videoWidth * coverScale;
  const displayedHeight = geo.videoHeight * coverScale;
  const cropX = (displayedWidth - geo.containerWidth) / 2;
  const cropY = (displayedHeight - geo.containerHeight) / 2;
  return { x: mx * displayedWidth - cropX, y: ny * displayedHeight - cropY };
}

/** Debug-only: how many pixels of the video's own frame are being cropped off each side by object-fit: cover. */
export function computeCoverCrop(geo: VideoGeometry): { cropX: number; cropY: number } {
  if (!hasValidGeometry(geo)) return { cropX: 0, cropY: 0 };
  const coverScale = Math.max(geo.containerWidth / geo.videoWidth, geo.containerHeight / geo.videoHeight);
  return {
    cropX: (geo.videoWidth * coverScale - geo.containerWidth) / 2,
    cropY: (geo.videoHeight * coverScale - geo.containerHeight) / 2,
  };
}

/**
 * Re-expresses a raw FootPose (normalized against the raw video/image frame)
 * in terms of the actual visible container instead — position, length, and
 * heading are all recomputed from container pixels so they reflect what's
 * really on screen. Mirroring is resolved here, once; `footPoseToTransform`
 * below no longer needs to know about it at all.
 */
export function correctFootPoseForVideoGeometry(pose: FootPose, geo: VideoGeometry): FootPose {
  const centerPx = mapVideoPointToContainer(pose.center.x, pose.center.y, geo);
  const heelPx = mapVideoPointToContainer(pose.heel.x, pose.heel.y, geo);
  const toePx = mapVideoPointToContainer(pose.toe.x, pose.toe.y, geo);
  const anklePx = mapVideoPointToContainer(pose.ankle.x, pose.ankle.y, geo);

  const cw = geo.containerWidth || 1;
  const ch = geo.containerHeight || 1;

  // Heading and length are computed directly in container pixels — a space
  // where a screen pixel is (approximately) the same size in x and y — so
  // they aren't distorted the way mixing raw-video-normalized x (a fraction
  // of video width) and y (a fraction of video height) would be whenever the
  // video isn't square.
  const lengthPx = Math.hypot(toePx.x - heelPx.x, toePx.y - heelPx.y) || 0.05 * ch;
  const heading = Math.atan2(toePx.y - heelPx.y, toePx.x - heelPx.x);

  return {
    ...pose,
    center: { x: centerPx.x / cw, y: centerPx.y / ch, z: pose.center.z },
    heel: { x: heelPx.x / cw, y: heelPx.y / ch, z: pose.heel.z },
    toe: { x: toePx.x / cw, y: toePx.y / ch, z: pose.toe.z },
    ankle: { x: anklePx.x / cw, y: anklePx.y / ch, z: pose.ankle.z },
    // Expressed as a fraction of container height, matching viewport.height —
    // the same reference footPoseToTransform's scale formula already uses.
    length: lengthPx / ch,
    heading,
  };
}

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
}

export interface ShoeTransform {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: number;
}

/** A shoe's outsole is typically ~5-15% longer than the bare foot inside it. */
const FOOT_TO_SHOE_LENGTH_RATIO = 1.1;

/**
 * Converts a FootPose into a Three.js transform. Expects `pose` to already be
 * expressed relative to the actual on-screen container (see
 * `correctFootPoseForVideoGeometry` above) — mirroring and any video/container
 * aspect-ratio crop must already be resolved by that point, so this function
 * stays pure screen-fraction-to-world-unit math with no camera-facing-mode
 * branching of its own (one mirror correction, applied once, upstream).
 */
export function footPoseToTransform(
  pose: FootPose,
  calibration: ShoeCalibration,
  viewport: ViewportPlane
): ShoeTransform {
  const worldX = (pose.center.x - 0.5) * viewport.width;
  const worldY = (0.5 - pose.center.y) * viewport.height;

  // pose.length is the heel-to-toe span as a fraction of the container height;
  // multiplying by viewport.height converts that directly into world units of
  // *this* viewport — the same conversion worldX/worldY above already rely on
  // — so the shoe is sized from the foot's actual measured on-screen extent
  // rather than an assumed, easily-wrong viewing distance.
  const targetShoeWorldLength = pose.length * viewport.height * FOOT_TO_SHOE_LENGTH_RATIO;
  // The model is normalized (see modelLoader.normalizeModel) so its own
  // longest dimension is exactly 1, making that length directly the scale factor.
  const scale = targetShoeWorldLength * calibration.scale;

  const position = new THREE.Vector3(
    worldX + calibration.offsetX,
    worldY + calibration.offsetY,
    calibration.offsetZ
  );

  // Convert from "angle from +x axis" to a rotation around Z so the shoe's forward
  // axis (assumed +Z after normalization) points toward the toe direction.
  const screenRotationZ = -(pose.heading - Math.PI / 2);

  const euler = new THREE.Euler(
    THREE.MathUtils.degToRad(calibration.rotationX),
    THREE.MathUtils.degToRad(calibration.rotationY),
    screenRotationZ + THREE.MathUtils.degToRad(calibration.rotationZ),
    "XYZ"
  );
  const quaternion = new THREE.Quaternion().setFromEuler(euler);

  return { position, scale, quaternion };
}

/**
 * Computes the world-space plane size an orthographic camera should frame.
 * `aspect` must be the actual on-screen container's aspect ratio (the
 * element the camera canvas fills), not the raw video's intrinsic aspect
 * ratio — those two differ whenever `object-fit: cover` crops the video to
 * fit, which live mode always does. Using the wrong one here stretches/
 * squishes the rendered scene relative to what's actually behind it.
 */
export function computeViewportPlane(aspect: number, baseHeight = 4): ViewportPlane {
  return { width: baseHeight * aspect, height: baseHeight };
}
