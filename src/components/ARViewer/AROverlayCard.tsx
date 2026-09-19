import type { ReactNode } from "react";

interface AROverlayCardProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void; icon?: ReactNode };
  tone?: "neutral" | "error";
}

/**
 * Floating translucent card used for the AR screen's transient states
 * (point-camera-at-feet, loading, error, no-foot-detected) — deliberately
 * NOT a full-screen takeover, so the live camera stays visible behind it,
 * matching the reference design's lighter-touch overlay treatment.
 */
export function AROverlayCard({ icon, title, subtitle, action, tone = "neutral" }: AROverlayCardProps) {
  return (
    <div className="pointer-events-none absolute inset-x-6 top-[18%] flex justify-center">
      <div className="pointer-events-auto flex w-full max-w-xs flex-col items-center gap-3 rounded-2xl bg-black/60 px-6 py-6 text-center backdrop-blur-md">
        <div
          className={[
            "flex h-12 w-12 items-center justify-center rounded-full",
            tone === "error" ? "bg-red-500/15 text-red-400" : "bg-white/10 text-white",
          ].join(" ")}
        >
          {icon}
        </div>
        <div className="space-y-1">
          <h3 className="text-[15px] font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-xs leading-relaxed text-white/60">{subtitle}</p>}
        </div>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-white/30 px-4 py-2 text-xs font-medium text-white transition hover:bg-white/10"
          >
            {action.icon}
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
