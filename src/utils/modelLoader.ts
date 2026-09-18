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
 */
export function normalizeModel(object: THREE.Object3D, targetSize = 1): void {
  const bounds = calculateModelBounds(object);
  const scale = targetSize / bounds.maxDimension;
  object.scale.setScalar(scale);
  object.position.copy(bounds.center).multiplyScalar(-scale);
}

function buildPlaceholderShoe(seed: number): THREE.Group {
  // A clearly-stylized placeholder so it never reads as a "real" product photo —
  // used only until a real .glb is dropped into public/models/.
  const group = new THREE.Group();
  const hue = (seed * 57) % 360;
  const color = new THREE.Color(`hsl(${hue}, 45%, 55%)`);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1 });

  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 1), material);
  sole.position.y = -0.05;

  const upperShape = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.16, 0.55, 4, 8),
    material.clone()
  );
  upperShape.rotation.x = Math.PI / 2;
  upperShape.scale.set(1, 1, 1.15);
  upperShape.position.set(0, 0.05, 0.05);

  const toeCap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), material.clone());
  toeCap.scale.set(1, 0.7, 0.8);
  toeCap.position.set(0, 0.02, 0.55);

  group.add(sole, upperShape, toeCap);
  group.name = "placeholder-shoe";
  normalizeModel(group, 1);
  return group;
}

function loadRaw(url: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      (gltf) => resolve(gltf.scene),
      undefined,
      (err) => reject(err)
    );
  });
}

/**
 * Loads (or returns a cached clone source for) the shoe at `url`. Falls back to a
 * procedural placeholder mesh if the .glb is missing/invalid, so the app stays
 * usable before real product models are supplied (see README "Adding shoe models").
 */
export async function loadShoeModel(url: string, placeholderSeed = 0): Promise<THREE.Group> {
  let entry = modelCache.get(url);
  if (!entry) {
    const promise = loadRaw(url)
      .then((scene) => {
        normalizeModel(scene, 1);
        return scene;
      })
      .catch((err) => {
        console.warn(`[modelLoader] Failed to load "${url}", using placeholder shoe.`, err);
        return buildPlaceholderShoe(placeholderSeed);
      });
    entry = { promise };
    modelCache.set(url, entry);
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
export function preloadShoeModel(url: string, placeholderSeed = 0): void {
  if (!modelCache.has(url)) {
    void loadShoeModel(url, placeholderSeed);
  }
}
