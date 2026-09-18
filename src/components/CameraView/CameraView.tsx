import { forwardRef } from "react";

interface CameraViewProps {
  mirrored: boolean;
  className?: string;
}

/** Plain <video> surface for the live camera feed. Kept dumb/presentational — useCamera owns the stream. */
export const CameraView = forwardRef<HTMLVideoElement, CameraViewProps>(function CameraView(
  { mirrored, className },
  ref
) {
  return (
    <video
      ref={ref}
      playsInline
      muted
      autoPlay
      className={[
        "h-full w-full object-cover",
        mirrored ? "-scale-x-100" : "",
        className ?? "",
      ].join(" ")}
      aria-label="Live camera feed"
    />
  );
});
