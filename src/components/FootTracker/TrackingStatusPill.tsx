import type { TrackingStatus } from "../../types/tracking";

const STATUS_COPY: Record<TrackingStatus, { label: string; tone: "good" | "neutral" | "warn" | "bad" }> = {
  idle: { label: "Starting camera…", tone: "neutral" },
  "loading-model": { label: "Preparing tracking…", tone: "neutral" },
  "no-feet": { label: "Move your feet into view", tone: "warn" },
  "one-foot": { label: "One foot detected", tone: "neutral" },
  tracking: { label: "Feet detected", tone: "good" },
  "low-confidence": { label: "Low tracking confidence", tone: "warn" },
  "camera-unavailable": { label: "Camera unavailable", tone: "bad" },
  error: { label: "Tracking error", tone: "bad" },
};

const TONE_DOT: Record<string, string> = {
  good: "bg-emerald-400",
  neutral: "bg-neutral-400",
  warn: "bg-amber-400",
  bad: "bg-red-500",
};

interface TrackingStatusPillProps {
  status: TrackingStatus;
}

export function TrackingStatusPill({ status }: TrackingStatusPillProps) {
  const copy = STATUS_COPY[status];
  return (
    <div
      className="pointer-events-none inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <span className={["h-1.5 w-1.5 rounded-full", TONE_DOT[copy.tone]].join(" ")} aria-hidden="true" />
      {copy.label}
    </div>
  );
}
