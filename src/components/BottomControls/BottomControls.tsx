interface BottomControlsProps {
  onCapture: () => void;
  onSwitchCamera: () => void;
  onUploadClick: () => void;
  canSwitchCamera: boolean;
  captureDisabled?: boolean;
}

export function BottomControls({
  onCapture,
  onSwitchCamera,
  onUploadClick,
  canSwitchCamera,
  captureDisabled,
}: BottomControlsProps) {
  return (
    <div className="flex items-center justify-center gap-6 px-6 py-4">
      <button
        type="button"
        onClick={onUploadClick}
        aria-label="Upload a photo instead"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 16V4M12 4l-4 4M12 4l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      <button
        type="button"
        onClick={onCapture}
        disabled={captureDisabled}
        aria-label="Capture photo"
        className="flex h-[68px] w-[68px] items-center justify-center rounded-full border-4 border-white bg-white/20 transition active:scale-95 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <span className="h-14 w-14 rounded-full bg-white" />
      </button>

      <button
        type="button"
        onClick={onSwitchCamera}
        disabled={!canSwitchCamera}
        aria-label="Switch camera"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 7h3l1.5-2h7L17 7h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M9 12a3 3 0 106 0 3 3 0 00-6 0z" stroke="currentColor" strokeWidth="1.6" />
          <path d="M16 4l1.5 2M8 4L6.5 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
