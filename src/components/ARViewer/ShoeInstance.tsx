import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { useShoeModel } from "../../hooks/useShoeModel";

import {
  footPoseToTransform,
  type ViewportPlane,
} from "../../utils/shoeAlignment";

import {
  SmoothedQuaternion,
  SmoothedScalar,
} from "../../utils/smoothing";

import type { FootPose } from "../../types/tracking";

import type {
  FootSide,
  ShoeCalibration,
} from "../../types/shoe";

interface ShoeInstanceProps {
  side: FootSide;
  poseRef: RefObject<FootPose | null>;
  modelUrl: string;
  calibration: ShoeCalibration;
  viewport: ViewportPlane;
  mirrorMesh: boolean;
  modelTestMode?: boolean;
  forceHidden?: boolean;
  onLoadedChange?: (loaded: boolean) => void;
}

const TRACKING_GRACE_MS = 180;
const MIN_MODEL_LENGTH = 0.00001;

/**
 * The supplied shoe1.glb contains TWO shoes:
 *
 * - nodes containing "rConv" belong to the right shoe
 * - nodes containing "lConv" belong to the left shoe
 *
 * We extract only the requested side before calculating the
 * bounding box / scale.
 */
function isNodeForSide(
  object: THREE.Object3D,
  side: FootSide
): boolean {
  const name = object.name.toLowerCase();

  const isRight =
    name.includes("rconv") ||
    name.includes("_rivet");

  const isLeft =
    name.includes("lconv") ||
    name.includes("_lrivet");

  if (side === "right") {
    return isRight && !isLeft;
  }

  return isLeft && !isRight;
}

/**
 * Hide the opposite shoe inside shoe1.glb.
 *
 * This GLB contains both left and right shoes as separate root nodes.
 */
function isolateFootSide(
  object: THREE.Object3D,
  side: FootSide
): void {
  object.traverse((child) => {
    const name = child.name.toLowerCase();

    if (!name) return;

    const right =
      name.includes("rconv") ||
      name.includes("_rivet");

    const left =
      name.includes("lconv") ||
      name.includes("_lrivet");

    /*
     * If the node clearly belongs to one side,
     * show only the requested side.
     */
    if (right || left) {
      child.visible =
        side === "right" ? right && !left : left && !right;
    }
  });
}

/**
 * Calculate the visible model dimensions.
 */
function getModelBounds(
  object: THREE.Object3D
): THREE.Box3 {
  object.updateMatrixWorld(true);

  return new THREE.Box3().setFromObject(object);
}

/**
 * Get the actual heel-to-toe length.
 *
 * The supplied GLB is not a simple X/Z aligned model.
 * Instead of blindly assuming X or Z, we use the largest
 * horizontal dimension after isolating one shoe.
 */
function getModelLength(
  object: THREE.Object3D
): number {
  const box = getModelBounds(object);

  if (box.isEmpty()) {
    return 1;
  }

  const size = new THREE.Vector3();

  box.getSize(size);

  const horizontalLength = Math.max(
    Math.abs(size.x),
    Math.abs(size.z)
  );

  if (
    !Number.isFinite(horizontalLength) ||
    horizontalLength < MIN_MODEL_LENGTH
  ) {
    return 1;
  }

  return horizontalLength;
}

/**
 * Center only the isolated shoe.
 */
function centerModel(
  object: THREE.Object3D
): void {
  const box = getModelBounds(object);

  if (box.isEmpty()) {
    return;
  }

  const center = new THREE.Vector3();

  box.getCenter(center);

  object.position.sub(center);

  object.updateMatrixWorld(true);
}

/**
 * Find which horizontal axis is the actual shoe length.
 *
 * The provided GLB has a diagonal-looking coordinate system,
 * so we do not apply an arbitrary 90 degree rotation here.
 *
 * The actual foot heading from MediaPipe controls the final
 * world rotation.
 */
function normalizeModelOrientation(
  object: THREE.Object3D
): void {
  const box = getModelBounds(object);

  if (box.isEmpty()) {
    return;
  }

  const size = new THREE.Vector3();

  box.getSize(size);

  /*
   * Do NOT rotate the GLB based purely on X/Z.
   *
   * shoe1.glb contains both shoe meshes and its geometry is
   * already authored with its own local orientation.
   *
   * Rotating it here was one of the reasons the shoe could
   * appear disconnected from the foot.
   */
  void size;
}

/**
 * Prepare the GLB for AR.
 */
function prepareModel(
  source: THREE.Object3D,
  side: FootSide
): {
  object: THREE.Object3D;
  nativeLength: number;
} {
  const object = source.clone(true);

  /*
   * Only keep the requested shoe.
   */
  isolateFootSide(object, side);

  object.traverse((child) => {
    const mesh = child as THREE.Mesh;

    if (!mesh.isMesh) {
      return;
    }

    mesh.frustumCulled = false;

    /*
     * Ensure invisible opposite-side meshes really stay invisible.
     */
    if (!isNodeForSide(child, side)) {
      const name = child.name.toLowerCase();

      const belongsToOtherSide =
        side === "right"
          ? name.includes("lconv") ||
            name.includes("_lrivet")
          : name.includes("rconv") ||
            name.includes("_rivet");

      if (belongsToOtherSide) {
        child.visible = false;
      }
    }

    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material) => {
          material.needsUpdate = true;
        });
      } else {
        mesh.material.needsUpdate = true;
      }
    }
  });

  /*
   * Update world matrices before measuring.
   */
  object.updateMatrixWorld(true);

  normalizeModelOrientation(object);

  /*
   * Measure ONLY the selected shoe.
   */
  const nativeLength =
    getModelLength(object);

  /*
   * Center ONLY the selected shoe.
   */
  centerModel(object);

  object.updateMatrixWorld(true);

  return {
    object,
    nativeLength:
      Number.isFinite(nativeLength) &&
      nativeLength > MIN_MODEL_LENGTH
        ? nativeLength
        : 1,
  };
}

export function ShoeInstance({
  side,
  poseRef,
  modelUrl,
  calibration,
  viewport,
  mirrorMesh,
  modelTestMode = false,
  forceHidden = false,
  onLoadedChange,
}: ShoeInstanceProps) {
  const { scene } =
    useShoeModel(modelUrl);

  const groupRef =
    useRef<THREE.Group>(null);

  const modelRootRef =
    useRef<THREE.Group>(null);

  const quatSmoother =
    useRef(
      new SmoothedQuaternion()
    );

  const scaleSmoother =
    useRef(
      new SmoothedScalar()
    );

  const modelScene =
    useRef<THREE.Object3D | null>(
      null
    );

  const nativeModelLength =
    useRef(1);

  const lastTransform =
    useRef<{
      position: THREE.Vector3;
      quaternion: THREE.Quaternion;
      scale: number;
      timestamp: number;
    } | null>(null);

  /**
   * Prepare model whenever:
   *
   * - GLB changes
   * - selected foot changes
   */
  useEffect(() => {
    if (!scene) {
      modelScene.current = null;
      nativeModelLength.current = 1;

      onLoadedChange?.(false);

      return;
    }

    const prepared =
      prepareModel(
        scene,
        side
      );

    modelScene.current =
      prepared.object;

    nativeModelLength.current =
      prepared.nativeLength;

    onLoadedChange?.(true);

    return () => {
      modelScene.current = null;
      nativeModelLength.current = 1;
    };
  }, [
    scene,
    side,
    onLoadedChange,
  ]);

  useFrame(() => {
    const group =
      groupRef.current;

    if (!group) {
      return;
    }

    /**
     * ---------------------------------------------------------
     * FORCE HIDDEN
     * ---------------------------------------------------------
     */
    if (forceHidden) {
      group.visible = false;
      return;
    }

    /**
     * ---------------------------------------------------------
     * MODEL TEST MODE
     * ---------------------------------------------------------
     */
    if (modelTestMode) {
      group.visible = true;

      group.position.set(
        mirrorMesh
          ? viewport.width * 0.18
          : -viewport.width * 0.18,
        0,
        0
      );

      group.quaternion.identity();

      /*
       * Test mode now uses the actual normalized shoe length.
       * This makes the model much easier to inspect.
       */
      const desiredTestLength =
        Math.min(
          viewport.width,
          viewport.height
        ) * 0.45;

      const nativeLength =
        Math.max(
          nativeModelLength.current,
          MIN_MODEL_LENGTH
        );

      group.scale.setScalar(
        desiredTestLength /
          nativeLength
      );

      quatSmoother.current.reset();
      scaleSmoother.current.reset();

      return;
    }

    /**
     * ---------------------------------------------------------
     * REAL TRACKING
     * ---------------------------------------------------------
     */
    const pose =
      poseRef.current;

    /*
     * Do not invent a shoe position if tracking is lost.
     */
    if (!pose) {
      const now =
        performance.now();

      const previous =
        lastTransform.current;

      if (
        previous &&
        now -
          previous.timestamp <
          TRACKING_GRACE_MS
      ) {
        group.visible = true;

        group.position.copy(
          previous.position
        );

        group.quaternion.copy(
          previous.quaternion
        );

        group.scale.setScalar(
          previous.scale
        );

        return;
      }

      group.visible = false;

      quatSmoother.current.reset();
      scaleSmoother.current.reset();

      return;
    }

    /**
     * ---------------------------------------------------------
     * FOOT → SHOE TRANSFORM
     * ---------------------------------------------------------
     */
    const transform =
      footPoseToTransform(
        pose,
        calibration,
        viewport
      );

    /**
     * transform.scale represents the desired
     * screen/world shoe length.
     *
     * Convert it into a multiplier based on
     * the REAL selected shoe length.
     */
    const safeNativeLength =
      Number.isFinite(
        nativeModelLength.current
      ) &&
      nativeModelLength.current >
        MIN_MODEL_LENGTH
        ? nativeModelLength.current
        : 1;

    const normalizedScale =
      transform.scale /
      safeNativeLength;

    const safeScale =
      Number.isFinite(
        normalizedScale
      )
        ? THREE.MathUtils.clamp(
            normalizedScale,
            0.0001,
            100000
          )
        : 0.0001;

    /**
     * Position
     */
    group.position.copy(
      transform.position
    );

    /**
     * Rotation
     */
    const smoothedQuaternion =
      quatSmoother.current.update(
        transform.quaternion
      );

    group.quaternion.copy(
      smoothedQuaternion
    );

    /**
     * Scale
     */
    const smoothedScale =
      scaleSmoother.current.update(
        safeScale
      );

    group.scale.setScalar(
      Math.max(
        smoothedScale,
        0.0001
      )
    );

    group.visible = true;

    /**
     * Save last valid transform.
     */
    lastTransform.current = {
      position:
        transform.position.clone(),

      quaternion:
        smoothedQuaternion.clone(),

      scale:
        Math.max(
          smoothedScale,
          0.0001
        ),

      timestamp:
        performance.now(),
    };
  });

  /**
   * Model isn't loaded yet.
   */
  if (!scene) {
    return null;
  }

  const renderedScene =
    modelScene.current ??
    scene;

  return (
    <group
      ref={groupRef}
      visible={false}
      data-side={side}
    >
      <group
        ref={modelRootRef}
        scale={
          mirrorMesh
            ? [-1, 1, 1]
            : [1, 1, 1]
        }
      >
        <primitive
          object={renderedScene}
        />
      </group>
    </group>
  );
}