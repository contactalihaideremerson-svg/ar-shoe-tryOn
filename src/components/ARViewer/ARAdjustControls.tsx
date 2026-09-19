interface ARAdjustControlsProps {
  onRotateLeft: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onZoomIn: () => void;
  onRotateRight: () => void;
  resetDisabled: boolean;
}

function ControlButton({
  onClick,
  disabled,
  label,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="flex flex-col items-center gap-1 text-white disabled:opacity-40"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm transition group-active:bg-black/60">
        {children}
      </span>
      <span className="text-[10px] font-medium text-white/80">{label}</span>
    </button>
  );
}

/** Explicit fallback controls for adjustments that are fiddly as gestures — gestures (drag/pinch/twist) remain the primary path. */
export function ARAdjustControls({ onRotateLeft, onZoomOut, onReset, onZoomIn, onRotateRight, resetDisabled }: ARAdjustControlsProps) {
  return (
    <div className="flex items-center justify-center gap-5 px-4">
      <ControlButton onClick={onRotateLeft} label="Rotate Left" ariaLabel="Rotate left">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 12a8 8 0 1 1 2.5 5.8M4 12v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </ControlButton>
      <ControlButton onClick={onZoomOut} label="Zoom Out" ariaLabel="Decrease size">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </ControlButton>
      <ControlButton onClick={onReset} disabled={resetDisabled} label="Reset" ariaLabel="Reset adjustments">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </ControlButton>
      <ControlButton onClick={onZoomIn} label="Zoom In" ariaLabel="Increase size">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </ControlButton>
      <ControlButton onClick={onRotateRight} label="Rotate Right" ariaLabel="Rotate right">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M20 12a8 8 0 1 0-2.5 5.8M20 12v5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </ControlButton>
    </div>
  );
}
