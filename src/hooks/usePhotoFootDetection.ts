import { useCallback, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { computeFootPose, computeLegReference } from "../utils/footGeometry";
import { correctFootPoseForVideoGeometry } from "../utils/shoeAlignment";
import type { FootPose } from "../types/tracking";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export type PhotoDetectionState = "idle" | "loading" | "detecting" | "success" | "no-feet" | "error";

/**
 * Stricter than live tracking's default (0.35): a still photo gets one shot at
 * detection with no follow-up frames to correct a bad guess, so a borderline
 * detection should fall back to "couldn't detect your feet" rather than
 * render a shoe at a confidently-wrong position.
 */
const PHOTO_MIN_CONFIDENCE = 0.55;

/** One-shot foot detection over a static <img>, for the Photo Try-On flow (capture or upload). */
export function usePhotoFootDetection() {
  const [state, setState] = useState<PhotoDetectionState>("idle");
  const landmarkerRef = useRef<PoseLandmarker | null>(null);

  const getLandmarker = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current;
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
    const landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "IMAGE",
      numPoses: 1,
      minPoseDetectionConfidence: 0.4,
      minPosePresenceConfidence: 0.4,
    });
    landmarkerRef.current = landmarker;
    return landmarker;
  }, []);

  const detect = useCallback(
    async (image: HTMLImageElement): Promise<{ left: FootPose | null; right: FootPose | null }> => {
      setState("loading");
      try {
        const landmarker = await getLandmarker();
        setState("detecting");
        const result = landmarker.detect(image);
        const landmarks = result.landmarks?.[0];
        if (!landmarks) {
          setState("no-feet");
          return { left: null, right: null };
        }
        const rawLeft = computeFootPose(landmarks, "left", computeLegReference(landmarks, "left"), PHOTO_MIN_CONFIDENCE);
        const rawRight = computeFootPose(landmarks, "right", computeLegReference(landmarks, "right"), PHOTO_MIN_CONFIDENCE);
        if (!rawLeft && !rawRight) {
          setState("no-feet");
          return { left: null, right: null };
        }
        // TryOnCanvas always sizes its box to exactly match the photo's own
        // aspect ratio (no object-fit crop for photo mode), so "container"
        // here is just the image's own dimensions — routed through the same
        // centralized function live mode uses rather than skipping it, so
        // there's still only one place this conversion is implemented.
        const geometry = {
          videoWidth: image.naturalWidth,
          videoHeight: image.naturalHeight,
          containerWidth: image.naturalWidth,
          containerHeight: image.naturalHeight,
          mirrored: false,
        };
        const left = rawLeft ? correctFootPoseForVideoGeometry(rawLeft, geometry) : null;
        const right = rawRight ? correctFootPoseForVideoGeometry(rawRight, geometry) : null;
        setState("success");
        return { left, right };
      } catch (err) {
        console.error("[usePhotoFootDetection] detection failed", err);
        setState("error");
        return { left: null, right: null };
      }
    },
    [getLandmarker]
  );

  return { detect, state };
}
