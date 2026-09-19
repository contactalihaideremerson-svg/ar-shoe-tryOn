interface ARHeaderProps {
  title: string;
  onClose: () => void;
  onHelp?: () => void;
  /** Optional badge shown below the bar (e.g. the "Foot detected" status pill). */
  children?: React.ReactNode;
}

/**
 * Header used on the AR camera screen specifically — a translucent dark bar
 * over the live video (not an opaque white bar like the rest of the app),
 * with a close (X) action instead of back, matching the reference design's
 * full-screen camera treatment.
 */
export function ARHeader({ title, onClose, onHelp, children }: ARHeaderProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 safe-top bg-gradient-to-b from-black/60 to-transparent px-4 pb-8 pt-3">
      <div className="pointer-events-auto flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <h1 className="text-sm font-semibold uppercase tracking-wide text-white">{title}</h1>
        {onHelp ? (
          <button
            type="button"
            onClick={onHelp}
            aria-label="How to use"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.8.35-1.4 1.1-1.4 2.2v.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="17.5" r="1" fill="currentColor" />
            </svg>
          </button>
        ) : (
          <div className="h-9 w-9" />
        )}
      </div>
      {children && <div className="pointer-events-auto mt-3 flex justify-center">{children}</div>}
    </div>
  );
}
