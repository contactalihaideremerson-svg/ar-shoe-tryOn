import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ARViewer } from "../ARViewer/ARViewer";
import { usePhotoFootDetection, type PhotoDetectionState } from "../../hooks/usePhotoFootDetection";
import { compositeShoeOntoPhoto } from "../../utils/imageProcessing";
import { buildClothesOccluderMask } from "../../utils/segmentation";
import type { ShoeProduct } from "../../types/shoe";
import type { FootPose } from "../../types/tracking";

export interface TryOnCanvasHandle {
  getCompositeDataUrl: () => string | null;
}

interface TryOnCanvasProps {
  imageDataUrl: string;
  shoe: ShoeProduct;
  onStatusChange?: (status: PhotoDetectionState) => void;
}

/**
 * Renders a static photo with the selected shoe composited over the detected
 * foot/feet. Reuses the live ARViewer/ARScene renderer with a single,
 * unchanging pose — original pixels (background/skin/legs/lighting) are left
 * completely untouched; only the transparent shoe layer is drawn on top.
 */
export const TryOnCanvas = forwardRef<TryOnCanvasHandle, TryOnCanvasProps>(function TryOnCanvas(
  { imageDataUrl, shoe, onStatusChange },
  ref
) {
  const imgRef = useRef<HTMLImageElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const leftPoseRef = useRef<FootPose | null>(null);
  const rightPoseRef = useRef<FootPose | null>(null);
  const occluderMaskRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState(1);
  const [ready, setReady] = useState(false);
  const [boxSize, setBoxSize] = useState({ width: 0, height: 0 });
  const { detect, state } = usePhotoFootDetection();

  // Compute an explicit "contain" pixel size for the photo box instead of relying
  // on CSS `aspect-ratio` + `height:100%` + `max-width:100%` resolving together —
  // that combination doesn't reliably shrink height to respect max-width across
  // browser engines, which was silently cropping/skewing the source photo.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const recompute = () => {
      const { width: cw, height: ch } = container.getBoundingClientRect();
      if (!cw || !ch) return;
      const containerAspect = cw / ch;
      if (aspect > containerAspect) {
        setBoxSize({ width: cw, height: cw / aspect });
      } else {
        setBoxSize({ width: ch * aspect, height: ch });
      }
    };

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(container);
    return () => observer.disconnect();
  }, [aspect]);

  useEffect(() => {
    onStatusChange?.(state);
  }, [state, onStatusChange]);

  useEffect(() => {
    setReady(false);
    leftPoseRef.current = null;
    rightPoseRef.current = null;
    occluderMaskRef.current = null;
    let cancelled = false;

    const img = new Image();
    img.onload = async () => {
      const width = img.width;
      const height = img.height;
      setAspect(width / height);
      const result = await detect(img);
      if (cancelled) return;
      leftPoseRef.current = result.left;
      rightPoseRef.current = result.right;
      setReady(true);

      // Best-effort background enhancement, entirely on-device — never blocks
      // the initial render above, and silently no-ops if it fails for any
      // reason (older device, model fetch hiccup, etc).
      if (result.left || result.right) {
        buildClothesOccluderMask(img, width, height).then((canvas) => {
          if (!cancelled) occluderMaskRef.current = canvas;
        });
      }
    };
    img.src = imageDataUrl;

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageDataUrl]);

  useImperativeHandle(ref, () => ({
    getCompositeDataUrl: () => {
      const img = imgRef.current;
      const canvas = glCanvasRef.current;
      if (!img || !canvas) return null;
      const { naturalWidth: width, naturalHeight: height } = img;

      const occluder = occluderMaskRef.current;
      if (!occluder) {
        return compositeShoeOntoPhoto(img, canvas, width, height);
      }

      // Punch holes in a copy of the shoe layer wherever the person's real
      // pants/legs should occlude it, so those original pixels show through
      // from the base image drawn underneath instead of the shoe floating
      // on top of a trouser cuff it should be tucked behind.
      const punched = document.createElement("canvas");
      punched.width = width;
      punched.height = height;
      const ctx = punched.getContext("2d");
      if (!ctx) return compositeShoeOntoPhoto(img, canvas, width, height);
      ctx.drawImage(canvas, 0, 0, width, height);
      ctx.globalCompositeOperation = "destination-out";
      ctx.drawImage(occluder, 0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";

      return compositeShoeOntoPhoto(img, punched, width, height);
    },
  }));

  return (
    <div ref={containerRef} className="flex h-full w-full items-center justify-center overflow-hidden bg-black">
      {/* This box's pixel size exactly matches the source photo's aspect ratio
          (computed in JS, not CSS aspect-ratio — see the effect above), so the
          ARViewer canvas filling it 1:1 maps normalized landmark coords correctly. */}
      <div className="relative" style={{ width: boxSize.width, height: boxSize.height }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img ref={imgRef} src={imageDataUrl} alt="Your photo for virtual try-on" className="h-full w-full object-cover" />
        {ready && boxSize.width > 0 && (leftPoseRef.current || rightPoseRef.current) && (
          <ARViewer
            shoe={shoe}
            leftPoseRef={leftPoseRef}
            rightPoseRef={rightPoseRef}
            aspect={aspect}
            mirrored={false}
            preserveDrawingBuffer
            onCanvasReady={(canvas) => {
              glCanvasRef.current = canvas;
            }}
          />
        )}
      </div>
    </div>
  );
});
