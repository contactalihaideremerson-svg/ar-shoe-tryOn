import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

/**
 * GLB loading with a shared cache so switching shoes never re-fetches or
 * re-parses a model twice, plus normalization utilities so models from
 * different sources (e.g. Tripo3D exports with arbitrary origins/scales)
 * all end up centered at the origin with a consistent unit size.
 */

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

interface CacheEntry {
  promise: Promise<THREE.Group>;
}

const modelCache = new Map<string, CacheEntry>();

export interface ModelBounds {
  center: THREE.Vector3;
  size: THREE.Vector3;
  maxDimension: number;
}

export function calculateModelBounds(object: THREE.Object3D): ModelBounds {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);
  const maxDimension = Math.max(size.x, size.y, size.z) || 1;
  return { center, size, maxDimension };
}

export function centerModel(object: THREE.Object3D, bounds?: ModelBounds): ModelBounds {
  const b = bounds ?? calculateModelBounds(object);
  object.position.sub(b.center);
  return b;
}

/**
 * Centers the model and scales it so its largest dimension equals `targetSize`
 * world units. Since a transform composes as `world = position + scale * local`,
 * the position offset must itself be scaled — subtracting the raw (unscaled)
 * center here would leave large-scale source models (e.g. authored in cm/mm
 * rather than meters) wildly off-origin even after the scale is applied.
 *
 * Every GLB gets this treatment regardless of its native units/pivot — a
 * model authored at 300x our target scale and one authored at 0.01x both
 * come out the same normalized size. Diagnostic logging here is what lets a
 * real "extremely large/small" source model be told apart from a genuine
 * rendering bug (see the debug overlay's bounding-box readout).
 */
export function normalizeModel(object: THREE.Object3D, targetSize = 1): ModelBounds {
  const bounds = calculateModelBounds(object);
  const scale = targetSize / bounds.maxDimension;
  object.scale.setScalar(scale);
  object.position.copy(bounds.center).multiplyScalar(-scale);

  if (import.meta.env.DEV) {
    console.log(
      `[modelLoader] normalized "${object.name || "(unnamed)"}" — ` +
        `raw size: ${bounds.size.x.toFixed(3)} x ${bounds.size.y.toFixed(3)} x ${bounds.size.z.toFixed(3)}, ` +
        `raw center: (${bounds.center.x.toFixed(3)}, ${bounds.center.y.toFixed(3)}, ${bounds.center.z.toFixed(3)}), ` +
        `applied scale: ${scale.toExponential(3)}`
    );
    if (bounds.maxDimension > 1000 || bounds.maxDimension < 0.001) {
      console.warn(
        `[modelLoader] "${object.name || "(unnamed)"}" has an unusually extreme raw size ` +
          `(largest dimension ${bounds.maxDimension}) — likely authored in an unexpected unit ` +
          `(mm/cm vs m). Normalization compensates automatically, but double-check the export if ` +
          `the model still looks wrong after this.`
      );
    }
  }

  return bounds;
}

/**
 * Some GLBs load successfully but render invisible because of material/mesh
 * flags that don't hold in this app's context — e.g. backface culling on a
 * mesh whose winding order doesn't match our camera framing (confirmed to
 * happen with real downloaded assets, not just a hypothetical). This forces
 * a known-safe baseline rather than trusting every source file's authoring
 * assumptions, and logs anything that looks actually broken (as opposed to
 * just being made visible defensively) so it's diagnosable, not silent.
 */
function sanitizeMaterialsForVisibility(object: THREE.Object3D, sourceUrl: string): void {
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    if (!node.visible && import.meta.env.DEV) {
      console.warn(`[modelLoader] "${sourceUrl}": mesh "${node.name}" has visible=false in the source file.`);
    }
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const mat of materials) {
      if (!mat) continue;
      // Always render both faces: a real, encountered failure mode is a mesh
      // whose winding order culls as fully invisible from this app's fixed
      // camera angle even though the file itself is valid.
      mat.side = THREE.DoubleSide;
      if (import.meta.env.DEV && mat.transparent && mat.opacity < 0.05) {
        console.warn(
          `[modelLoader] "${sourceUrl}": material "${mat.name || "(unnamed)"}" on mesh "${node.name}" ` +
            `is transparent with opacity ${mat.opacity} — it may render as invisible.`
        );
      }
    }
  });
}

function loadRaw(url: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      (gltf) => resolve(gltf.scene),
      undefined,
      (err) => reject(err instanceof Error ? err : new Error(String(err)))
    );
  });
}

/**
 * Loads (or returns a cached clone source for) the shoe at `url`.
 *
 * Deliberately does NOT fall back to a placeholder on failure — an earlier
 * version did, which is exactly the kind of silent failure this app must not
 * have in production: if a shoe can't load, the caller needs to know and
 * show a real error with a retry, not a plain shape standing in for it
 * unannounced. Rejects with the underlying GLTFLoader error; callers log the
 * URL and the exact error (see useShoeModel).
 */
export async function loadShoeModel(url: string): Promise<THREE.Group> {
  let entry = modelCache.get(url);
  if (!entry) {
    const promise = loadRaw(url).then((scene) => {
      scene.name = url;
      normalizeModel(scene, 1);
      sanitizeMaterialsForVisibility(scene, url);
      return scene;
    });
    entry = { promise };
    modelCache.set(url, entry);
    // A failed load must not poison the cache for a future retry.
    promise.catch(() => modelCache.delete(url));
  }
  const source = await entry.promise;
  return cloneModel(source);
}

/** SkeletonUtils-free deep clone sufficient for our static (non-skinned) shoe meshes. */
export function cloneModel(source: THREE.Group): THREE.Group {
  const clone = source.clone(true);
  clone.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.material = Array.isArray(node.material)
        ? node.material.map((m) => m.clone())
        : node.material.clone();
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  return clone;
}

/**
 * Disposes only the per-instance cloned materials/textures of a shoe instance
 * produced by `cloneModel`. Geometry is intentionally left alone — clones
 * share geometry buffers with the cached source model, and disposing them
 * here would corrupt every other instance still using that cache entry.
 */
export function disposeShoeInstance(object: THREE.Object3D): void {
  object.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const mat of materials) {
        if (!mat) continue;
        Object.values(mat).forEach((value) => {
          if (value instanceof THREE.Texture) value.dispose();
        });
        mat.dispose();
      }
    }
  });
}

/** Fully disposes geometries/materials/textures — only safe for objects that are NOT shared via the model cache. */
export function disposeModel(object: THREE.Object3D): void {
  object.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.geometry?.dispose();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const mat of materials) {
        if (!mat) continue;
        Object.values(mat).forEach((value) => {
          if (value instanceof THREE.Texture) value.dispose();
        });
        mat.dispose();
      }
    }
  });
}

/** Warms the cache for a shoe without displaying it yet (e.g. "likely next" prefetch). */
export function preloadShoeModel(url: string): void {
  if (!modelCache.has(url)) {
    // Errors here are surfaced properly the next time something actually
    // awaits loadShoeModel(url) for display (the rejected promise is
    // deleted from the cache in loadShoeModel, so that retry hits the
    // network again rather than replaying this swallowed failure).
    loadShoeModel(url).catch(() => undefined);
  }
}
