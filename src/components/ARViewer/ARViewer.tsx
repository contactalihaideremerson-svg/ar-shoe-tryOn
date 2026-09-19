import { Canvas } from "@react-three/fiber";
import { ARScene } from "./ARScene";
import { computeViewportPlane } from "../../utils/shoeAlignment";
import type { RefObject } from "react";
import type { FootPose } from "../../types/tracking";
import type { ShoeProduct } from "../../types/shoe";

interface ARViewerProps {
  shoe: ShoeProduct;
  leftPoseRef: RefObject<FootPose | null>;
  rightPoseRef: RefObject<FootPose | null>;
  aspect: number;
  mirrored: boolean;
  /** Needed so a still frame can be read back for photo-mode compositing/export. */
  preserveDrawingBuffer?: boolean;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  /** Diagnostic-only: see ShoeInstance/ARScene. */
  modelTestMode?: boolean;
  forceHidden?: boolean;
  onLoadedChange?: (loaded: boolean) => void;
}

/**
 * Transparent WebGL overlay rendered on top of the camera <video>. Pose refs
 * are mutated imperatively by the tracking loop (see useARTracking) so the
 * render loop stays decoupled from React's commit cycle — only useFrame
 * inside ShoeInstance touches the Three.js scene graph each tick.
 */
export function ARViewer({
  shoe,
  leftPoseRef,
  rightPoseRef,
  aspect,
  mirrored,
  preserveDrawingBuffer = false,
  onCanvasReady,
  modelTestMode = false,
  forceHidden = false,
  onLoadedChange,
}: ARViewerProps) {
  const viewport = computeViewportPlane(aspect, mirrored);

  return (
    <Canvas
      className="pointer-events-none absolute inset-0 h-full w-full"
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance", preserveDrawingBuffer }}
      dpr={[1, 2]}
      style={{ background: "transparent" }}
      onCreated={(state) => onCanvasReady?.(state.gl.domElement)}
    >
      <ARScene
        shoe={shoe}
        leftPoseRef={leftPoseRef}
        rightPoseRef={rightPoseRef}
        viewport={viewport}
        modelTestMode={modelTestMode}
        forceHidden={forceHidden}
        onLoadedChange={onLoadedChange}
      />
    </Canvas>
  );
}
