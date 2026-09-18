import { useRef, useState } from "react";
import { TryOnCanvas, type TryOnCanvasHandle } from "../TryOnCanvas/TryOnCanvas";
import { ShoeSelector } from "../ShoeSelector/ShoeSelector";
import { ErrorState } from "../ErrorState/ErrorState";
import { LoadingScreen } from "../LoadingScreen/LoadingScreen";
import { downloadDataUrl } from "../../utils/imageProcessing";
import { trackEvent } from "../../utils/analytics";
import type { PhotoDetectionState } from "../../hooks/usePhotoFootDetection";
import type { ShoeProduct } from "../../types/shoe";

interface PhotoTryOnViewProps {
  imageDataUrl: string;
  shoe: ShoeProduct;
  shoeIndex: number;
  onSelectShoe: (shoe: ShoeProduct) => void;
  onRetake: () => void;
  onBackToCamera: () => void;
  canReturnToCamera: boolean;
}

export function PhotoTryOnView({
  imageDataUrl,
  shoe,
  shoeIndex,
  onSelectShoe,
  onRetake,
  onBackToCamera,
  canReturnToCamera,
}: PhotoTryOnViewProps) {
  const canvasRef = useRef<TryOnCanvasHandle>(null);
  const [detectionState, setDetectionState] = useState<PhotoDetectionState>("idle");
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleSave = () => {
    const dataUrl = canvasRef.current?.getCompositeDataUrl();
    if (!dataUrl) return;
    downloadDataUrl(dataUrl, `virtual-try-on-${shoe.id}.png`);
    trackEvent({ name: "try_on_completed", mode: "photo", shoeId: shoe.id });
  };

  const isLoading = detectionState === "loading" || detectionState === "detecting" || detectionState === "idle";
  const noFeet = detectionState === "no-feet";
  const detectionError = detectionState === "error";

  return (
    <div className="flex h-full w-full flex-col bg-black">
      <div className="relative flex-1 overflow-hidden">
        <TryOnCanvas
          ref={canvasRef}
          imageDataUrl={imageDataUrl}
          shoe={shoe}
          shoeIndex={shoeIndex}
          onStatusChange={setDetectionState}
        />

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

        {pickerOpen && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent pb-3 pt-8">
            <ShoeSelector selectedId={shoe.id} onSelect={onSelectShoe} />
          </div>
        )}
      </div>

      {/* Primary action gets its own full-width row so it's always fully visible and
          easy to tap; secondary actions wrap onto a second line on narrow screens
          instead of being clipped off the edge in a single non-wrapping row. */}
      <div className="safe-bottom flex flex-col gap-2.5 px-4 py-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading || noFeet || detectionError}
          className="w-full rounded-full bg-white py-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 disabled:opacity-40"
        >
          Save Result
        </button>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={onRetake}
            className="rounded-full bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/20"
          >
            Retake
          </button>
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="rounded-full bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/20"
          >
            Change Shoe
          </button>
          {canReturnToCamera && (
            <button
              type="button"
              onClick={onBackToCamera}
              className="rounded-full bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/20"
            >
              Back to Camera
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
