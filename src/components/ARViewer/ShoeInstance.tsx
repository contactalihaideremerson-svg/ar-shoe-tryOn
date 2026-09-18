import { useRef } from "react";
import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useShoeModel } from "../../hooks/useShoeModel";
import { footPoseToTransform, type ViewportPlane } from "../../utils/shoeAlignment";
import { SmoothedQuaternion, SmoothedScalar } from "../../utils/smoothing";
import type { FootPose } from "../../types/tracking";
import type { FootSide, ShoeCalibration } from "../../types/shoe";

interface ShoeInstanceProps {
  side: FootSide;
  poseRef: RefObject<FootPose | null>;
  modelUrl: string;
  placeholderSeed: number;
  calibration: ShoeCalibration;
  viewport: ViewportPlane;
  /** Mirrors the mesh on X for the opposite foot when the source .glb only models one shoe. */
  mirrorMesh: boolean;
}

export function ShoeInstance({
  side,
  poseRef,
  modelUrl,
  placeholderSeed,
  calibration,
  viewport,
  mirrorMesh,
}: ShoeInstanceProps) {
  const { scene } = useShoeModel(modelUrl, placeholderSeed);
  const groupRef = useRef<THREE.Group>(null);
  const quatSmoother = useRef(new SmoothedQuaternion());
  const scaleSmoother = useRef(new SmoothedScalar());
  const wasVisible = useRef(false);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const pose = poseRef.current;

    if (!pose) {
      if (wasVisible.current) {
        group.visible = false;
        quatSmoother.current.reset();
        scaleSmoother.current.reset();
        wasVisible.current = false;
      }
      return;
    }

    if (!wasVisible.current) {
      group.visible = true;
      wasVisible.current = true;
    }

    const transform = footPoseToTransform(pose, calibration, viewport);
    group.position.copy(transform.position);
    const smoothedQuat = quatSmoother.current.update(transform.quaternion);
    group.quaternion.copy(smoothedQuat);
    const smoothedScale = scaleSmoother.current.update(transform.scale);
    group.scale.setScalar(smoothedScale);
    void delta;
  });

  if (!scene) return null;

  return (
    <group ref={groupRef} visible={false} data-side={side}>
      {/* A separate wrapping group applies the mirror flip multiplicatively on top of
          whatever scale normalizeModel already baked into `scene` — setting `scale`
          directly on the <primitive> would overwrite (not compose with) that scale
          and snap the model back to its original, un-normalized size. */}
      <group scale={mirrorMesh ? [-1, 1, 1] : [1, 1, 1]}>
        <primitive object={scene} />
      </group>
    </group>
  );
}
