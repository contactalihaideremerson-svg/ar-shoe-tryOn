import { useRef, useState } from "react";
import { TryOnCanvas, type TryOnCanvasHandle } from "../TryOnCanvas/TryOnCanvas";
import { ErrorState } from "../ErrorState/ErrorState";
import { LoadingScreen } from "../LoadingScreen/LoadingScreen";
import { downloadDataUrl } from "../../utils/imageProcessing";
import { trackEvent } from "../../utils/analytics";
import type { PhotoDetectionState } from "../../hooks/usePhotoFootDetection";
import type { ShoeProduct } from "../../types/shoe";

interface PhotoTryOnViewProps {
  imageDataUrl: string;
  shoe: ShoeProduct;
  onRetake: () => void;
  onBackToCamera: () => void;
  canReturnToCamera: boolean;
}

export function PhotoTryOnView({ imageDataUrl, shoe, onRetake, onBackToCamera, canReturnToCamera }: PhotoTryOnViewProps) {
  const canvasRef = useRef<TryOnCanvasHandle>(null);
  const [detectionState, setDetectionState] = useState<PhotoDetectionState>("idle");

  const isLoading = detectionState === "loading" || detectionState === "detecting" || detectionState === "idle";
  const noFeet = detectionState === "no-feet";
  const detectionError = detectionState === "error";
  const actionsDisabled = isLoading || noFeet || detectionError;

  const handleSave = () => {
    const dataUrl = canvasRef.current?.getCompositeDataUrl();
    if (!dataUrl) return;
    downloadDataUrl(dataUrl, `virtual-try-on-${shoe.id}.png`);
    trackEvent({ name: "try_on_completed", mode: "photo", shoeId: shoe.id });
  };

  const handleShare = async () => {
    const dataUrl = canvasRef.current?.getCompositeDataUrl();
    if (!dataUrl) return;
    try {
      const blob = await fetch(dataUrl).then((r) => r.blob());
      const file = new File([blob], `virtual-try-on-${shoe.id}.png`, { type: blob.type || "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My Virtual Try-On" });
        trackEvent({ name: "try_on_completed", mode: "photo", shoeId: shoe.id });
      } else {
        // No native file-sharing support — fall back to a direct download.
        downloadDataUrl(dataUrl, `virtual-try-on-${shoe.id}.png`);
      }
    } catch {
      // User cancelled the share sheet, or the share failed — nothing to recover.
    }
  };

  return (
    <div className="relative flex h-full w-full flex-col bg-black">
      <div className="relative flex-1 overflow-hidden">
        <TryOnCanvas ref={canvasRef} imageDataUrl={imageDataUrl} shoe={shoe} onStatusChange={setDetectionState} />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 safe-top bg-gradient-to-b from-black/60 to-transparent px-4 pb-8 pt-3">
          <div className="pointer-events-auto flex items-center justify-between">
            <button
              type="button"
              onClick={canReturnToCamera ? onBackToCamera : onRetake}
              aria-label="Back"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h1 className="text-sm font-semibold uppercase tracking-wide text-white">Your Try-On</h1>
            <div className="h-9 w-9" />
          </div>
        </div>

        {isLoading && (
          <div className="absolute inset-0">
            <LoadingScreen message="Detecting your feet…" />
          </div>
        )}

        {noFeet && (
          <div className="absolute inset-0 bg-black/85">
            <ErrorState
              icon="warning"
              title="We couldn't detect your feet"
              message="Try a brighter photo with your full feet clearly visible, ideally from a straight-on angle."
              actionLabel="Retake Photo"
              onAction={onRetake}
              secondaryLabel="Upload Different Photo"
              onSecondary={onBackToCamera}
            />
          </div>
        )}

        {detectionError && (
          <div className="absolute inset-0 bg-black/85">
            <ErrorState
              icon="warning"
              title="Something went wrong"
              message="We couldn't process that photo. Please try again."
              actionLabel="Retake Photo"
              onAction={onRetake}
            />
          </div>
        )}
      </div>

      <div className="safe-bottom flex flex-col gap-2.5 px-4 py-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={actionsDisabled}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 disabled:opacity-40"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Save Image
        </button>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onRetake}
            className="flex-1 rounded-full border border-white/25 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Try Another
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={actionsDisabled}
            className="flex-1 rounded-full border border-white/25 py-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-40"
          >
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
