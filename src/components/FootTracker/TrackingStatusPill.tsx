import type { TrackingStatus } from "../../types/tracking";

/**
 * Only rendered for "something is detected" states — matches the reference
 * design, where problem states (no feet, loading, error) are communicated
 * via the centered AROverlayCard instead of this pill. Returns null rather
 * than an empty pill so callers can render it unconditionally.
 */
const DETECTED_COPY: Partial<Record<TrackingStatus, string>> = {
  tracking: "Foot detected",
  "one-foot": "Foot detected",
  "low-confidence": "Foot detected",
};

interface TrackingStatusPillProps {
  status: TrackingStatus;
}

export function TrackingStatusPill({ status }: TrackingStatusPillProps) {
  const label = DETECTED_COPY[status];
  if (!label) return null;

  return (
    <div
      className="pointer-events-none inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
      role="status"
      aria-live="polite"
    >
      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/25" aria-hidden="true">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
          <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {label}
    </div>
  );
}
