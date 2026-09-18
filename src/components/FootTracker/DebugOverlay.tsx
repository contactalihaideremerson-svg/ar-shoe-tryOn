import type { FootPose } from "../../types/tracking";

interface DebugOverlayProps {
  left: FootPose | null;
  right: FootPose | null;
  fps: number;
  shoeId: string;
  mirrored: boolean;
  videoWidth: number;
  videoHeight: number;
}

function Marker({ pose, mirrored }: { pose: FootPose; mirrored: boolean }) {
  const nx = mirrored ? 1 - pose.center.x : pose.center.x;
  return (
    <>
      <div
        className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-lime-400"
        style={{ left: `${nx * 100}%`, top: `${pose.center.y * 100}%` }}
      />
      <div
        className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400"
        style={{ left: `${(mirrored ? 1 - pose.ankle.x : pose.ankle.x) * 100}%`, top: `${pose.ankle.y * 100}%` }}
      />
      <div
        className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-400"
        style={{ left: `${(mirrored ? 1 - pose.toe.x : pose.toe.x) * 100}%`, top: `${pose.toe.y * 100}%` }}
      />
    </>
  );
}

/** Development-only visualization of landmarks/FPS/transform state. Never rendered in production builds. */
export function DebugOverlay({ left, right, fps, shoeId, mirrored, videoWidth, videoHeight }: DebugOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {left && <Marker pose={left} mirrored={mirrored} />}
      {right && <Marker pose={right} mirrored={mirrored} />}
      <div className="absolute left-2 top-2 space-y-0.5 rounded-md bg-black/70 p-2 font-mono text-[10px] leading-tight text-lime-300">
        <div>FPS: {fps.toFixed(1)}</div>
        <div>Shoe: {shoeId}</div>
        <div>Video: {videoWidth}x{videoHeight}</div>
        <div>L conf: {left ? left.confidence.toFixed(2) : "-"}</div>
        <div>R conf: {right ? right.confidence.toFixed(2) : "-"}</div>
      </div>
    </div>
  );
}
