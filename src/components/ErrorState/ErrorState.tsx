interface ErrorStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  icon?: "camera" | "warning" | "upload";
}

function Icon({ kind }: { kind: NonNullable<ErrorStateProps["icon"]> }) {
  if (kind === "camera") {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 8a2 2 0 012-2h2l1.5-2h7L17 6h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "upload") {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 16V4M12 4l-4 4M12 4l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.18A1.5 1.5 0 003.53 20.5h16.94a1.5 1.5 0 001.42-2.46L13.71 3.86a1.5 1.5 0 00-2.42 0z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function ErrorState({
  title,
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  icon = "warning",
}: ErrorStateProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-8 text-center" role="alert">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
        <Icon kind={icon} />
      </div>
      <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
      <p className="max-w-xs text-sm leading-relaxed text-neutral-500">{message}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            {actionLabel}
          </button>
        )}
        {secondaryLabel && onSecondary && (
          <button
            type="button"
            onClick={onSecondary}
            className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
