import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";

/**
 * On-device person/clothes segmentation for Photo Try-On, using MediaPipe's
 * own multiclass selfie segmenter — the same on-device model family already
 * used for foot tracking, just a different task. No backend, no API token,
 * no signup, nothing ever leaves the browser: it's the free, frictionless
 * alternative to routing photos through a third-party API for this.
 *
 * Used for one thing: an "occluder" mask (the "clothes" category) that gets
 * redrawn on top of the composited shoe wherever they overlap, so a trouser
 * cuff correctly covers part of the shoe instead of the shoe floating in
 * front of it. This model has no dedicated "shoe" category, so — unlike the
 * earlier Hugging Face design — it can't also refine MediaPipe Pose's
 * ankle/heel/toe position estimate against a visible-shoe mask; that idea is
 * dropped rather than faked.
 */

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite";

// Category indices for the selfie_multiclass_256x256 model's fixed label set.
const CATEGORY_CLOTHES = 4;

let segmenterPromise: Promise<ImageSegmenter> | null = null;

function getSegmenter(): Promise<ImageSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = FilesetResolver.forVisionTasks(WASM_BASE).then((vision) =>
      ImageSegmenter.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "IMAGE",
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      })
    );
  }
  return segmenterPromise;
}

/**
 * Runs on-device segmentation and returns an alpha-mask canvas (sized to
 * `width`x`height`) marking "clothes" pixels, suitable for use as a
 * `destination-out` stencil. Returns null on any failure — callers should
 * treat this as a best-effort enhancement, not a requirement.
 */
export async function buildClothesOccluderMask(
  image: HTMLImageElement,
  width: number,
  height: number
): Promise<HTMLCanvasElement | null> {
  try {
    const segmenter = await getSegmenter();
    const result = segmenter.segment(image);
    const categoryMask = result.categoryMask;
    if (!categoryMask) {
      result.close();
      return null;
    }

    const categories = categoryMask.getAsUint8Array();
    const maskWidth = categoryMask.width;
    const maskHeight = categoryMask.height;
    result.close();

    // Render the low-res category mask into a same-size canvas first, then
    // let drawImage scale it up to the target size in one step.
    const small = document.createElement("canvas");
    small.width = maskWidth;
    small.height = maskHeight;
    const smallCtx = small.getContext("2d");
    if (!smallCtx) return null;
    const imageData = smallCtx.createImageData(maskWidth, maskHeight);
    for (let i = 0; i < categories.length; i++) {
      const isClothes = categories[i] === CATEGORY_CLOTHES;
      imageData.data[i * 4 + 3] = isClothes ? 255 : 0;
    }
    smallCtx.putImageData(imageData, 0, 0);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(small, 0, 0, width, height);
    return canvas;
  } catch (err) {
    console.warn("[segmentation] on-device clothes segmentation failed — continuing without occlusion", err);
    return null;
  }
}
