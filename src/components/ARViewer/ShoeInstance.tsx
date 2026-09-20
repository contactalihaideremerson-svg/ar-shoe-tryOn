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
  /** Mirrors the mesh on X for the opposite foot when the source .glb only models one shoe. */
  mirrorMesh: boolean;
  /**
   * Diagnostic-only: when true, ignore tracking entirely and place the model
   * fixed at the viewport center at a fixed readable size.
   */
  modelTestMode?: boolean;
  /** Diagnostic-only: force the model invisible. */
  forceHidden?: boolean;
  onLoadedChange?: (loaded: boolean) => void;
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
  const { scene } = useShoeModel(modelUrl);

  const groupRef = useRef<THREE.Group>(null);

  const quatSmoother = useRef(
    new SmoothedQuaternion()
  );

  const scaleSmoother = useRef(
    new SmoothedScalar()
  );

  const wasVisible = useRef(false);

  /**
   * Create an independent scene clone for this ShoeInstance.
   *
   * The same GLB can be used for left and right shoes, but each rendered
   * instance needs its own scene graph so one side cannot re-parent or
   * otherwise interfere with the other side.
   */
  const modelScene = useRef<THREE.Object3D | null>(
    null
  );

  useEffect(() => {
    if (!scene) {
      modelScene.current = null;
      onLoadedChange?.(false);
      return;
    }

    const clonedScene = scene.clone(true);

    clonedScene.traverse((object) => {
      const mesh = object as THREE.Mesh;

      if (mesh.isMesh) {
        mesh.frustumCulled = false;

        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((material) => {
              material.needsUpdate = true;
            });
          } else {
            mesh.material.needsUpdate = true;
          }
        }
      }
    });

    modelScene.current = clonedScene;
    onLoadedChange?.(true);

    return () => {
      modelScene.current = null;
    };
  }, [scene, onLoadedChange]);

  useFrame((_, delta) => {
    const group = groupRef.current;

    if (!group) return;

    if (forceHidden) {
      group.visible = false;
      return;
    }

    /**
     * MODEL TEST MODE
     *
     * Completely ignores tracking and puts the model in an obvious,
     * readable position. This is useful to verify that Three.js + GLB
     * rendering itself is working.
     */
    if (modelTestMode) {
      group.visible = true;
      wasVisible.current = true;

      group.position.set(
        mirrorMesh
          ? viewport.width * 0.18
          : -viewport.width * 0.18,
        0,
        0
      );

      group.quaternion.identity();

      const testSize =
        Math.min(
          viewport.width,
          viewport.height
        ) * 0.32;

      group.scale.setScalar(testSize);

      quatSmoother.current.reset();
      scaleSmoother.current.reset();

      void delta;
      return;
    }

    const pose = poseRef.current;

    /**
     * IMPORTANT:
     *
     * Previously the model was completely hidden whenever tracking had no
     * pose. That meant the user could open the camera and see absolutely
     * nothing until the tracking pipeline produced a pose.
     *
     * We now keep the model visible as soon as the GLB is loaded.
     * Once a real pose arrives, the normal tracking transform takes over.
     */
    if (!pose) {
      group.visible = true;
      wasVisible.current = true;

      /**
       * Fallback live position.
       *
       * Put the shoe slightly below the center of the camera view.
       * This guarantees that a successfully loaded GLB is visible even
       * before foot tracking has produced a pose.
       */
      const fallbackX = mirrorMesh
        ? viewport.width * 0.18
        : -viewport.width * 0.18;

      const fallbackY =
        -viewport.height * 0.12;

      group.position.set(
        fallbackX,
        fallbackY,
        0
      );

      group.quaternion.identity();

      /**
       * Use calibration scale when available, but guarantee a readable
       * minimum size for the live fallback.
       */
      const baseFallbackSize =
        Math.min(
          viewport.width,
          viewport.height
        ) * 0.22;

      const calibrationScale =
        Number.isFinite(calibration.scale) &&
        calibration.scale > 0
          ? calibration.scale
          : 1;

      const fallbackScale =
        baseFallbackSize *
        calibrationScale;

      group.scale.setScalar(
        Math.max(
          fallbackScale,
          Math.min(
            viewport.width,
            viewport.height
          ) * 0.12
        )
      );

      quatSmoother.current.reset();
      scaleSmoother.current.reset();

      void delta;
      return;
    }

    /**
     * REAL FOOT TRACKING
     *
     * As soon as the tracker produces a pose, use the exact existing
     * alignment system. Manual calibration continues to work because
     * footPoseToTransform receives the complete ShoeCalibration object.
     */
    if (!wasVisible.current) {
      group.visible = true;
      wasVisible.current = true;
    }

    const transform = footPoseToTransform(
      pose,
      calibration,
      viewport
    );

    group.visible = true;

    group.position.copy(
      transform.position
    );

    const smoothedQuat =
      quatSmoother.current.update(
        transform.quaternion
      );

    group.quaternion.copy(
      smoothedQuat
    );

    const smoothedScale =
      scaleSmoother.current.update(
        transform.scale
      );

    /**
     * Protect against an invalid/near-zero scale coming from tracking.
     * A zero or extremely tiny scale makes the model effectively invisible.
     */
    const minimumScale = Math.max(
      0.0001,
      Math.min(
        viewport.width,
        viewport.height
      ) * 0.001
    );

    group.scale.setScalar(
      Math.max(
        smoothedScale,
        minimumScale
      )
    );

    void delta;
  });

  if (!scene) {
    return null;
  }

  const renderedScene =
    modelScene.current ?? scene;

  return (
    <group
      ref={groupRef}
      visible={true}
      data-side={side}
    >
      {/*
        Mirror only the mesh contents.

        The outer group remains responsible for the tracked
        position/rotation/scale. This prevents the mirror operation
        from interfering with the tracking transform.
      */}
      <group
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