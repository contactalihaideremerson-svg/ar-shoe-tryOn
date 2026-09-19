import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { useFootTracking } from "./useFootTracking";
import type { FootPose } from "../types/tracking";

/**
 * Bridges useFootTracking's React state into plain refs the R3F render loop
 * can read every frame without forcing a React re-render of the 3D scene.
 * UI-facing status/fps still come back as regular state for the status pill.
 */
export function useARTracking(
  videoEl: HTMLVideoElement | null,
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  mirrored: boolean
) {
  const tracking = useFootTracking(videoEl, containerRef, enabled, mirrored);
  const leftPoseRef = useRef<FootPose | null>(null);
  const rightPoseRef = useRef<FootPose | null>(null);

  useEffect(() => {
    leftPoseRef.current = tracking.left;
  }, [tracking.left]);

  useEffect(() => {
    rightPoseRef.current = tracking.right;
  }, [tracking.right]);

  return {
    leftPoseRef,
    rightPoseRef,
    status: tracking.status,
    fps: tracking.fps,
    modelStatus: tracking.modelStatus,
    left: tracking.left,
    right: tracking.right,
    reload: tracking.reload,
  };
}
