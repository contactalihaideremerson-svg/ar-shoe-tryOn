import type { FootPose } from "../../types/tracking";

interface DebugOverlayProps {
  left: FootPose | null;
  right: FootPose | null;
  fps: number;
  shoeId: string;
  videoWidth: number;
  videoHeight: number;
}

/**
 * `pose.center/heel/toe/ankle` are already expressed as fractions of this
 * same container, with mirroring already resolved — see
 * `correctFootPoseForVideoGeometry` in shoeAlignment.ts, the one place that
 * conversion happens. Positioning these markers via plain CSS percentage is
 * therefore correct as-is; re-flipping for `mirrored` here would mirror the
 * point a second time.
 */
function Marker({ pose }: { pose: FootPose }) {
  const pct = (v: { x: number; y: number }) => ({ left: `${v.x * 100}%`, top: `${v.y * 100}%` });
  return (
    <>
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        <line
          x1={`${pose.heel.x * 100}%`}
          y1={`${pose.heel.y * 100}%`}
          x2={`${pose.toe.x * 100}%`}
          y2={`${pose.toe.y * 100}%`}
          stroke="#facc15"
          strokeWidth={2}
        />
      </svg>
      {/* Center = green, heel = red, toe = blue — if these dots aren't sitting
          on the real foot, the problem is tracking/geometry, not the 3D shoe. */}
      <div className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-400 bg-emerald-400/30" style={pct(pose.center)} />
      <div className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500" style={pct(pose.heel)} />
      <div className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500" style={pct(pose.toe)} />
    </>
  );
}

/** Development-only visualization of landmarks/FPS/transform state — "Show Tracking Points". */
export function DebugOverlay({ left, right, fps, shoeId, videoWidth, videoHeight }: DebugOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {left && <Marker pose={left} />}
      {right && <Marker pose={right} />}
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
