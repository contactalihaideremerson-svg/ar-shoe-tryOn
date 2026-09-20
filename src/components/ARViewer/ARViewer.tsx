import { Canvas } from "@react-three/fiber";
import { ARScene } from "./ARScene";
import { computeViewportPlane } from "../../utils/shoeAlignment";
import type { RefObject } from "react";
import type { FootPose } from "../../types/tracking";
import type {
  FootSide,
  ShoeProduct,
} from "../../types/shoe";

interface ARViewerProps {
  shoe: ShoeProduct;

  /**
   * Selected foot for the live single-shoe experience.
   *
   * Optional for backwards compatibility with photo-mode callers
   * that already use ARViewer without a foot selector.
   *
   * Defaults to the left foot.
   */
  activeSide?: FootSide;

  leftPoseRef: RefObject<FootPose | null>;
  rightPoseRef: RefObject<FootPose | null>;

  /** Aspect ratio of the actual on-screen container this canvas fills. */
  aspect: number;

  /** Needed so a still frame can be read back for photo-mode compositing/export. */
  preserveDrawingBuffer?: boolean;

  onCanvasReady?: (
    canvas: HTMLCanvasElement
  ) => void;

  /** Diagnostic-only: see ShoeInstance/ARScene. */
  modelTestMode?: boolean;

  forceHidden?: boolean;

  onLoadedChange?: (
    loaded: boolean
  ) => void;
}

/**
 * Transparent WebGL overlay rendered on top of the camera <video>.
 *
 * Layer order:
 *   z-0  = camera video
 *   z-10 = Three.js/WebGL shoe overlay
 *   z-20 = UI controls
 *
 * Only one ShoeInstance is rendered by ARScene.
 */
export function ARViewer({
  shoe,
  activeSide = "left",
  leftPoseRef,
  rightPoseRef,
  aspect,
  preserveDrawingBuffer = false,
  onCanvasReady,
  modelTestMode = false,
  forceHidden = false,
  onLoadedChange,
}: ARViewerProps) {
  const viewport = computeViewportPlane(
    aspect
  );

  return (
    <Canvas
      className="pointer-events-none absolute inset-0 z-10 block h-full w-full"
      gl={{
        alpha: true,
        antialias: true,
        powerPreference:
          "high-performance",
        preserveDrawingBuffer,
      }}
      dpr={[1, 2]}
      style={{
        background: "transparent",
        opacity: 1,
        visibility: "visible",
      }}
      onCreated={(state) => {
        const canvas =
          state.gl.domElement;

        // Make absolutely sure the WebGL canvas itself is transparent.
        state.gl.setClearColor(
          0x000000,
          0
        );

        onCanvasReady?.(canvas);
      }}
    >
      <ARScene
        shoe={shoe}
        activeSide={activeSide}
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