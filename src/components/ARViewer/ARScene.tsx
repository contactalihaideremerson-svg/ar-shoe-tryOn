import { OrthographicCamera } from "@react-three/drei";
import { ShoeInstance } from "./ShoeInstance";
import type { RefObject } from "react";
import type { ViewportPlane } from "../../utils/shoeAlignment";
import type { FootPose } from "../../types/tracking";
import type { ShoeProduct } from "../../types/shoe";

interface ARSceneProps {
  shoe: ShoeProduct;
  leftPoseRef: RefObject<FootPose | null>;
  rightPoseRef: RefObject<FootPose | null>;
  viewport: ViewportPlane;
  placeholderSeed: number;
}

export function ARScene({ shoe, leftPoseRef, rightPoseRef, viewport, placeholderSeed }: ARSceneProps) {
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
      {/* Simplified product-viz lighting rig (key + fill + ambient) rather than a full HDRI
          environment, to keep the live AR loop lightweight on mobile GPUs. */}
      <ambientLight intensity={0.65} />
      <directionalLight position={[2, 4, 3]} intensity={0.9} />
      <directionalLight position={[-3, 1, -2]} intensity={0.35} />

      <ShoeInstance
        side="left"
        poseRef={leftPoseRef}
        modelUrl={shoe.model}
        placeholderSeed={placeholderSeed}
        calibration={shoe}
        viewport={viewport}
        mirrorMesh={false}
      />
      <ShoeInstance
        side="right"
        poseRef={rightPoseRef}
        modelUrl={shoe.model}
        placeholderSeed={placeholderSeed}
        calibration={shoe}
        viewport={viewport}
        mirrorMesh={true}
      />
    </>
  );
}
