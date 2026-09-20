import { forwardRef } from "react";

interface CameraViewProps {
  mirrored: boolean;
  className?: string;
}

/**
 * Live camera video surface.
 *
 * Layering:
 * z-0 = camera/background
 * Three.js AR canvas should sit above this layer.
 */
export const CameraView = forwardRef<HTMLVideoElement, CameraViewProps>(
  function CameraView({ mirrored, className }, ref) {
    return (
      <video
        ref={ref}
        playsInline
        muted
        autoPlay
        className={[
          "absolute inset-0 z-0 h-full w-full object-cover",
          mirrored ? "-scale-x-100" : "",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="Live camera feed"
      />
    );
  }
);

CameraView.displayName = "CameraView";