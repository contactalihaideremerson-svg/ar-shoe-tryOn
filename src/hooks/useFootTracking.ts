import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { computeFootPose, computeLegReference } from "../utils/footGeometry";
import { correctFootPoseForVideoGeometry } from "../utils/shoeAlignment";
import { SmoothedVector3, SmoothedScalar } from "../utils/smoothing";
import type { FootTrackingResult, TrackingStatus } from "../types/tracking";
import * as THREE from "three";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

interface FootSmoothers {
  position: SmoothedVector3;
  heading: SmoothedScalar;
  length: SmoothedScalar;
}

function makeSmoothers(): FootSmoothers {
  return {
    position: new SmoothedVector3(),
    heading: new SmoothedScalar(0.3),
    length: new SmoothedScalar(0.25),
  };
}

/**
 * Runs MediaPipe's Pose Landmarker over the live video feed to derive foot
 * poses. There is no standalone "foot landmarker" solution generally available
 * in-browser today, so the full-body Pose Landmarker is used and only its
 * ankle/heel/foot-index keypoints are consumed — this is the most accurate
 * currently-available browser-based approach (see README limitations).
 */
export function useFootTracking(
  videoEl: HTMLVideoElement | null,
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  mirrored: boolean
) {
  const [result, setResult] = useState<FootTrackingResult>({
    left: null,
    right: null,
    status: "idle",
    fps: 0,
  });
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const smoothersRef = useRef<{ left: FootSmoothers; right: FootSmoothers }>({
    left: makeSmoothers(),
    right: makeSmoothers(),
  });
  const lastTimeRef = useRef(0);
  const fpsRef = useRef({ frames: 0, last: performance.now(), value: 0 });
  const [modelStatus, setModelStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retryToken, setRetryToken] = useState(0);

  // Reflect model load progress/failure into the user-facing status so the UI
  // never gets stuck showing "Starting camera…" — a slow or blocked network
  // fetch for the WASM/model files (both hosted on external CDNs) would
  // otherwise leave `result.status` at its initial "idle" forever, since it's
  // only ever updated from inside the detection loop below, which never runs
  // until modelStatus becomes "ready".
  useEffect(() => {
    if (modelStatus === "loading") {
      setResult((prev) => (prev.status === "idle" ? { ...prev, status: "loading-model" } : prev));
    } else if (modelStatus === "error") {
      setResult((prev) => ({ ...prev, status: "error" }));
    }
  }, [modelStatus]);

  useEffect(() => {
    let cancelled = false;
    setModelStatus("loading");
    // Also clears any pose from a previous session/model instance so a
    // manual reload doesn't leave a stale foot pose on screen while the
    // fresh landmarker spins up.
    smoothersRef.current = { left: makeSmoothers(), right: makeSmoothers() };
    setResult({ left: null, right: null, status: "loading-model", fps: 0 });

    // A hung fetch (no error, no response — common on flaky mobile networks)
    // would otherwise leave modelStatus at "loading" forever with no recovery
    // path, so time out and surface it as a failure instead.
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        console.error("[useFootTracking] PoseLandmarker init timed out");
        setModelStatus("error");
      }
    }, 15000);

    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        window.clearTimeout(timeoutId);
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setModelStatus("ready");
      } catch (err) {
        window.clearTimeout(timeoutId);
        console.error("[useFootTracking] Failed to initialize PoseLandmarker", err);
        if (!cancelled) setModelStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [retryToken]);

  const reload = useCallback(() => setRetryToken((n) => n + 1), []);

  const tick = useCallback(() => {
    const video = videoEl;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const now = performance.now();
    if (now - lastTimeRef.current < 33) {
      // Cap detection to ~30fps to keep CPU/GPU headroom for rendering.
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const dt = (now - lastTimeRef.current) / 1000;
    lastTimeRef.current = now;

    fpsRef.current.frames += 1;
    if (now - fpsRef.current.last >= 500) {
      fpsRef.current.value = (fpsRef.current.frames * 1000) / (now - fpsRef.current.last);
      fpsRef.current.frames = 0;
      fpsRef.current.last = now;
    }

    try {
      const detection = landmarker.detectForVideo(video, now);
      const landmarks = detection.landmarks?.[0];

      let status: TrackingStatus = "no-feet";
      let leftPose = null;
      let rightPose = null;

      if (landmarks) {
        const leftLegRef = computeLegReference(landmarks, "left");
        const rightLegRef = computeLegReference(landmarks, "right");
        const detectedLeft = computeFootPose(landmarks, "left", leftLegRef);
        const detectedRight = computeFootPose(landmarks, "right", rightLegRef);

        // Re-express the raw (video-frame-normalized) pose in terms of the
        // actual visible container BEFORE smoothing — the video is almost
        // never the same aspect ratio as the container it's cover-fitted
        // into, and doing this correction after smoothing would just smooth
        // the wrong numbers. See shoeAlignment.ts for why this one function
        // is the only place this conversion happens.
        const containerRect = containerRef.current?.getBoundingClientRect();
        const geometry = {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          containerWidth: containerRect?.width ?? video.videoWidth,
          containerHeight: containerRect?.height ?? video.videoHeight,
          mirrored,
        };
        const rawLeft = detectedLeft ? correctFootPoseForVideoGeometry(detectedLeft, geometry) : null;
        const rawRight = detectedRight ? correctFootPoseForVideoGeometry(detectedRight, geometry) : null;

        if (rawLeft) {
          const sm = smoothersRef.current.left;
          const smoothedPos = sm.position.update(
            new THREE.Vector3(rawLeft.center.x, rawLeft.center.y, rawLeft.center.z),
            dt
          );
          leftPose = {
            ...rawLeft,
            center: { x: smoothedPos.x, y: smoothedPos.y, z: smoothedPos.z },
            heading: sm.heading.update(rawLeft.heading),
            length: sm.length.update(rawLeft.length),
          };
        } else {
          smoothersRef.current.left.position.reset();
        }

        if (rawRight) {
          const sm = smoothersRef.current.right;
          const smoothedPos = sm.position.update(
            new THREE.Vector3(rawRight.center.x, rawRight.center.y, rawRight.center.z),
            dt
          );
          rightPose = {
            ...rawRight,
            center: { x: smoothedPos.x, y: smoothedPos.y, z: smoothedPos.z },
            heading: sm.heading.update(rawRight.heading),
            length: sm.length.update(rawRight.length),
          };
        } else {
          smoothersRef.current.right.position.reset();
        }

        if (leftPose && rightPose) status = "tracking";
        else if (leftPose || rightPose) status = "one-foot";
        else status = "no-feet";

        const avgConfidence = ((leftPose?.confidence ?? 0) + (rightPose?.confidence ?? 0)) / (leftPose && rightPose ? 2 : 1);
        if (status === "tracking" && avgConfidence < 0.5) status = "low-confidence";
      }

      setResult({ left: leftPose, right: rightPose, status, fps: fpsRef.current.value });
    } catch (err) {
      console.error("[useFootTracking] detection error", err);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [videoEl, containerRef, mirrored]);

  useEffect(() => {
    if (!enabled || modelStatus !== "ready") return;
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, modelStatus, tick]);

  return { ...result, modelStatus, reload };
}
