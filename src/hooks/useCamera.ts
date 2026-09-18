import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { detectGetUserMedia, detectSecureContext } from "../utils/deviceDetection";

export type CameraPermissionState = "idle" | "requesting" | "granted" | "denied" | "unavailable";

export type CameraErrorReason =
  | "insecure-context"
  | "unsupported"
  | "permission-denied"
  | "not-found"
  | "in-use"
  | "unknown";

export interface UseCameraResult {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Pass this as the <video>'s `ref` instead of `videoRef` directly (see comment below). */
  setVideoEl: (node: HTMLVideoElement | null) => void;
  stream: MediaStream | null;
  permission: CameraPermissionState;
  error: CameraErrorReason | null;
  facingMode: "user" | "environment";
  isReady: boolean;
  requestCamera: () => Promise<void>;
  switchCamera: () => Promise<void>;
  stopCamera: () => void;
}

export function useCamera(initialFacingMode: "user" | "environment" = "environment"): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [permission, setPermission] = useState<CameraPermissionState>("idle");
  const [error, setError] = useState<CameraErrorReason | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">(initialFacingMode);
  const [isReady, setIsReady] = useState(false);

  const attachStream = useCallback((video: HTMLVideoElement, mediaStream: MediaStream) => {
    video.srcObject = mediaStream;
    video.play().catch(() => undefined);
  }, []);

  /**
   * A callback ref, not a plain object ref: the <video> element only exists
   * once the UI reaches its "live" state, but the stream can finish loading
   * (or already exist, e.g. returning from Photo Try-On) before or after
   * that DOM node mounts. A plain ref set once inside requestCamera() would
   * silently miss the element if it wasn't mounted yet — leaving the stream
   * fetched but never attached to any visible <video>, stuck tracking
   * readyState 0 forever. This re-attaches on every (re)mount instead.
   */
  const setVideoEl = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      if (node && streamRef.current) {
        attachStream(node, streamRef.current);
      }
    },
    [attachStream]
  );

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    setIsReady(false);
  }, []);

  const openStream = useCallback(async (mode: "user" | "environment") => {
    if (!detectSecureContext()) {
      setError("insecure-context");
      setPermission("unavailable");
      return;
    }
    if (!detectGetUserMedia()) {
      setError("unsupported");
      setPermission("unavailable");
      return;
    }

    setPermission("requesting");
    setError(null);
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = newStream;
      setStream(newStream);
      setPermission("granted");
      // Fire-and-forget play(): the <video> is already autoplay/muted/playsInline
      // (see CameraView), so playback starts natively regardless of this promise.
      // Some streams/browsers never settle it either way, and awaiting it would
      // block `isReady` — and everything gated on it, including AR tracking
      // startup — indefinitely. If the element isn't mounted yet, setVideoEl's
      // callback ref attaches the stream itself as soon as it does mount.
      if (videoRef.current) {
        attachStream(videoRef.current, newStream);
      }
      setIsReady(true);
    } catch (err) {
      const domErr = err as DOMException;
      if (domErr.name === "NotAllowedError" || domErr.name === "SecurityError") {
        setError("permission-denied");
      } else if (domErr.name === "NotFoundError" || domErr.name === "OverconstrainedError") {
        setError("not-found");
      } else if (domErr.name === "NotReadableError") {
        setError("in-use");
      } else {
        setError("unknown");
      }
      setPermission("denied");
      setIsReady(false);
    }
  }, [attachStream]);

  const requestCamera = useCallback(async () => {
    await openStream(facingMode);
  }, [openStream, facingMode]);

  const switchCamera = useCallback(async () => {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    await openStream(next);
  }, [facingMode, openStream]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return { videoRef, setVideoEl, stream, permission, error, facingMode, isReady, requestCamera, switchCamera, stopCamera };
}
