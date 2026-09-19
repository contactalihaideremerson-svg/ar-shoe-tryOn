interface HelpModalProps {
  onClose: () => void;
  dontShowAgain: boolean;
  onDontShowAgainChange: (value: boolean) => void;
}

const ITEMS = [
  {
    title: "Drag to move",
    description: "Touch and drag to adjust position",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 11V6a2 2 0 1 1 4 0v5m0-3V4a2 2 0 1 1 4 0v7m0-4a2 2 0 1 1 4 0v6a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.4l-2-3.4a1.7 1.7 0 0 1 2.7-2l1.3 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Pinch to resize",
    description: "Use two fingers to make the shoe bigger or smaller",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 3 4 7m0 0v-3m0 3h3M16 3l4 4m0 0v-3m0 3h-3M8 21l-4-4m0 0v3m0-3h3m8 4 4-4m0 0v3m0-3h-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Twist to rotate",
    description: "Use two fingers to rotate the shoe",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 12a8 8 0 1 1 2.5 5.8M4 12v5h5M20 12a8 8 0 1 0-2.5 5.8M20 12v5h-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Use controls",
    description: "You can also use the buttons below to fine-tune the adjustment",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 3v3m0 12v3m9-9h-3M6 12H3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function HelpModal({ onClose, dontShowAgain, onDontShowAgainChange }: HelpModalProps) {
  return (
    <div className="absolute inset-0 z-40 flex items-end bg-black/50" role="dialog" aria-modal="true" aria-label="How to use">
      <div className="safe-bottom w-full rounded-t-2xl bg-neutral-950 px-5 pb-5 pt-4 text-white">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">How to use</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-white/60 hover:text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {ITEMS.map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">{item.icon}</span>
              <div>
                <p className="text-sm font-medium text-white">{item.title}</p>
                <p className="text-xs leading-relaxed text-white/50">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        <label className="mt-5 flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => onDontShowAgainChange(e.target.checked)}
            className="h-4 w-4 rounded border-white/30 bg-transparent accent-white"
          />
          Don&apos;t show again
        </label>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-full bg-white py-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
