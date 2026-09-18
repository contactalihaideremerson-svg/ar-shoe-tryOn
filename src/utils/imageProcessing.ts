/**
 * Photo-mode helpers: capturing a full-resolution frame from the live video,
 * validating uploaded images, and compositing a rendered shoe layer over the
 * original photo without touching the background/skin/lighting.
 */

export interface CapturedImage {
  dataUrl: string;
  width: number;
  height: number;
}

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB
const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export function captureVideoFrame(video: HTMLVideoElement, mirrored: boolean): CapturedImage {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  if (mirrored) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.95),
    width: canvas.width,
    height: canvas.height,
  };
}

export interface UploadValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateUploadedFile(file: File): UploadValidationResult {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return { valid: false, reason: "Please upload a JPG, PNG, or WebP image." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { valid: false, reason: "That image is too large. Please use a file under 15MB." };
  }
  return { valid: true };
}

export function readFileAsImage(file: File): Promise<{ img: HTMLImageElement; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => resolve({ img, dataUrl });
      img.onerror = () => reject(new Error("That file doesn't look like a valid image."));
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Composites a transparent-background shoe render (from an offscreen Three.js
 * canvas) on top of the original photo, preserving the source pixels
 * everywhere else (legs, skin, background, lighting untouched).
 */
export function compositeShoeOntoPhoto(
  baseImage: HTMLImageElement | HTMLCanvasElement,
  shoeLayerCanvas: HTMLCanvasElement,
  width: number,
  height: number
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.drawImage(baseImage, 0, 0, width, height);
  ctx.drawImage(shoeLayerCanvas, 0, 0, width, height);

  return canvas.toDataURL("image/png");
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
