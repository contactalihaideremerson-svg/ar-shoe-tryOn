import { OrthographicCamera } from "@react-three/drei";
import { ShoeInstance } from "./ShoeInstance";
import type { RefObject } from "react";
import type { ViewportPlane } from "../../utils/shoeAlignment";
import type { FootPose } from "../../types/tracking";
import type { FootSide, ShoeProduct } from "../../types/shoe";

interface ARSceneProps {
  shoe: ShoeProduct;

  /**
   * Only one foot is rendered at a time.
   *
   * This makes the try-on behave like a real single-shoe
   * fitting experience instead of rendering two shoes together.
   */
  activeSide: FootSide;

  leftPoseRef: RefObject<FootPose | null>;
  rightPoseRef: RefObject<FootPose | null>;

  viewport: ViewportPlane;

  /** Diagnostic-only: see ShoeInstance. */
  modelTestMode?: boolean;

  forceHidden?: boolean;

  onLoadedChange?: (loaded: boolean) => void;
}

export function ARScene({
  shoe,
  activeSide,
  leftPoseRef,
  rightPoseRef,
  viewport,
  modelTestMode = false,
  forceHidden = false,
  onLoadedChange,
}: ARSceneProps) {
  /**
   * Select the pose belonging to the currently selected foot.
   *
   * IMPORTANT:
   * Only this pose is passed to ShoeInstance.
   * Therefore only one shoe can be rendered/tracked at a time.
   */
  const activePoseRef =
    activeSide === "left"
      ? leftPoseRef
      : rightPoseRef;

  /**
   * A single GLB can represent one shoe.
   *
   * For the opposite foot we mirror the mesh on X.
   */
  const mirrorMesh = activeSide === "right";

  return (
    <>
      <OrthographicCamera
        makeDefault
        position={[0, 0, 5]}
        left={-viewport.width / 2}
        right={viewport.width / 2}
        top={viewport.height / 2}
        bottom={-viewport.height / 2}
        near={0.1}
        far={100}
      />

      <ambientLight intensity={0.65} />

      <directionalLight
        position={[2, 4, 3]}
        intensity={0.9}
      />

      <directionalLight
        position={[-3, 1, -2]}
        intensity={0.35}
      />

      {/* 
        SINGLE SHOE INSTANCE

        Previously:
          left shoe + right shoe

        Now:
          active foot = one shoe only
      */}
      <ShoeInstance
        side={activeSide}
        poseRef={activePoseRef}
        modelUrl={shoe.model}
        calibration={shoe}
        viewport={viewport}
        mirrorMesh={mirrorMesh}
        modelTestMode={modelTestMode}
        forceHidden={forceHidden}
        onLoadedChange={onLoadedChange}
      />
    </>
  );
}