import { ErrorState } from "../ErrorState/ErrorState";
import type { CameraErrorReason } from "../../hooks/useCamera";

interface PermissionScreenProps {
  onEnableCamera: () => void;
  onUsePhotoInstead: () => void;
  requesting: boolean;
  error: CameraErrorReason | null;
}

const ERROR_COPY: Record<CameraErrorReason, { title: string; message: string }> = {
  "insecure-context": {
    title: "Secure connection required",
    message: "Camera access needs HTTPS. Please open this site over a secure connection to use Live AR.",
  },
  unsupported: {
    title: "Camera not supported",
    message: "This browser doesn't support camera access. Try a recent version of Chrome, Safari, or Edge, or use Photo Try-On instead.",
  },
  "permission-denied": {
    title: "Camera access denied",
    message: "Enable camera access for this site in your browser settings, then try again.",
  },
  "not-found": {
    title: "No camera found",
    message: "We couldn't find a camera on this device. You can still upload a photo to try shoes on.",
  },
  "in-use": {
    title: "Camera unavailable",
    message: "Your camera is being used by another app. Close it and try again.",
  },
  unknown: {
    title: "Something went wrong",
    message: "We couldn't access your camera. Please try again or use Photo Try-On.",
  },
};

export function PermissionScreen({ onEnableCamera, onUsePhotoInstead, requesting, error }: PermissionScreenProps) {
  if (error) {
    const copy = ERROR_COPY[error];
    return (
      <ErrorState
        icon="camera"
        title={copy.title}
        message={copy.message}
        actionLabel="Try Again"
        onAction={onEnableCamera}
        secondaryLabel="Try With Photo Instead"
        onSecondary={onUsePhotoInstead}
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5 bg-neutral-950 px-8 text-center text-white">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 8a2 2 0 012-2h2l1.5-2h7L17 6h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold">Virtual Shoe Try-On</h2>
        <p className="max-w-xs text-sm leading-relaxed text-neutral-400">
          Allow camera access to see how these shoes look on you in real time.
        </p>
      </div>
      <button
        type="button"
        onClick={onEnableCamera}
        disabled={requesting}
        className="w-full max-w-xs rounded-full bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {requesting ? "Requesting Access…" : "Enable Camera"}
      </button>
      <button
        type="button"
        onClick={onUsePhotoInstead}
        className="text-sm font-medium text-neutral-400 underline-offset-4 hover:text-white hover:underline"
      >
        Try With Photo Instead
      </button>
      <p className="max-w-xs text-[11px] leading-relaxed text-neutral-500">
        Your camera is used only for this virtual try-on experience. Video is processed on your device and never uploaded.
      </p>
    </div>
  );
}
