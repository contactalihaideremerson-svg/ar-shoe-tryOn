import * as THREE from "three";

/**
 * Real-device diagnostic overlay, enabled via `?debug=true` (in addition to
 * the always-dev-only Debug/Calibrate toggles) so it can be turned on for a
 * one-off check on a deployed build without a dev server. Exists specifically
 * to answer "is this a tracking problem or a rendering problem" without
 * guessing — see the Model Test / Show / Hide controls, which isolate the
 * two.
 */

interface DebugPanelProps {
  cameraPermission: string;
  cameraError: string | null;
  facingMode: string;
  mirrored: boolean;
  videoWidth: number;
  videoHeight: number;
  containerWidth: number;
  containerHeight: number;
  cropX: number;
  cropY: number;
  canvasWidth: number;
  canvasHeight: number;
  selectedShoeName: string;
  modelUrl: string;
  modelLoading: boolean;
  modelError: string | null;
  modelVisible: boolean;
  trackingStatus: string;
  trackingFps: number;
  leftConfidence: number | null;
  rightConfidence: number | null;
  footX: number | null;
  footY: number | null;
  footScreenX: number | null;
  footScreenY: number | null;
  footLengthPx: number | null;
  footHeadingDeg: number | null;
  modelPosition: THREE.Vector3 | null;
  modelScale: number | null;
  modelRotationZDeg: number | null;
  modelTestMode: boolean;
  onToggleModelTest: () => void;
  forceHidden: boolean;
  onToggleHidden: () => void;
  onReloadCamera: () => void;
  onReloadModel: () => void;
  onResetTracking: () => void;
  onResetShoe: () => void;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-white/10 py-1">
      <span className="text-white/50">{label}</span>
      <span className="text-right text-lime-300">{value}</span>
    </div>
  );
}

function fmt(n: number | null, digits = 3): string {
  return n === null || Number.isNaN(n) ? "—" : n.toFixed(digits);
}

export function DebugPanel(props: DebugPanelProps) {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "n/a";

  return (
    <div className="absolute inset-x-2 top-2 z-50 max-h-[85vh] overflow-y-auto rounded-xl border border-white/20 bg-black/85 p-3 font-mono text-[11px] text-white backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-sans text-xs font-semibold text-white">AR Debug (?debug=true)</span>
        <button type="button" onClick={props.onClose} className="text-white/60 hover:text-white" aria-label="Close debug panel">
          ✕
        </button>
      </div>

      <div className="mb-2 grid grid-cols-2 gap-2">
        <button type="button" onClick={props.onReloadCamera} className="rounded bg-white/10 px-2 py-1.5 font-sans hover:bg-white/20">
          Reload Camera
        </button>
        <button type="button" onClick={props.onReloadModel} className="rounded bg-white/10 px-2 py-1.5 font-sans hover:bg-white/20">
          Reload Model
        </button>
        <button type="button" onClick={props.onResetTracking} className="rounded bg-white/10 px-2 py-1.5 font-sans hover:bg-white/20">
          Reset Tracking
        </button>
        <button type="button" onClick={props.onResetShoe} className="rounded bg-white/10 px-2 py-1.5 font-sans hover:bg-white/20">
          Reset Shoe
        </button>
      </div>

      <div className="mb-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={props.onToggleModelTest}
          className={`rounded px-2 py-1.5 font-sans ${props.modelTestMode ? "bg-lime-400 text-black" : "bg-white/10 hover:bg-white/20"}`}
        >
          Model Test: {props.modelTestMode ? "ON" : "OFF"}
        </button>
        <button
          type="button"
          onClick={props.onToggleHidden}
          className={`rounded px-2 py-1.5 font-sans ${props.forceHidden ? "bg-red-500 text-white" : "bg-white/10 hover:bg-white/20"}`}
        >
          {props.forceHidden ? "SHOW MODEL" : "HIDE MODEL"}
        </button>
      </div>
      {props.modelTestMode && (
        <p className="mb-2 rounded bg-lime-400/10 p-1.5 font-sans text-lime-300">
          Model Test is ON: the shoe is forced to a fixed center position, ignoring foot tracking
          entirely. If it's visible here, rendering/loading works and any AR-mode issue is
          tracking/position/scale. If it's NOT visible here, the problem is GLB loading, materials,
          or the canvas/WebGL layer — not tracking.
        </p>
      )}

      <div className="mb-1 font-sans font-semibold text-white/70">Camera</div>
      <Row label="Permission" value={props.cameraPermission} />
      <Row label="Error" value={props.cameraError ?? "none"} />
      <Row label="Facing mode" value={props.facingMode} />
      <Row label="Mirrored" value={String(props.mirrored)} />
      <Row label="Video (intrinsic)" value={`${props.videoWidth} × ${props.videoHeight}`} />
      <Row label="Container (display)" value={`${Math.round(props.containerWidth)} × ${Math.round(props.containerHeight)}`} />
      <Row label="Canvas (drawing buffer)" value={`${props.canvasWidth} × ${props.canvasHeight}`} />
      <Row label="Object-fit crop X/Y" value={`${Math.round(props.cropX)}px / ${Math.round(props.cropY)}px`} />

      <div className="mb-1 mt-2 font-sans font-semibold text-white/70">Shoe / Model</div>
      <Row label="Selected shoe" value={props.selectedShoeName} />
      <Row label="Model URL" value={<span className="break-all">{props.modelUrl}</span>} />
      <Row label="Loading" value={String(props.modelLoading)} />
      <Row label="Load error" value={props.modelError ?? "none"} />
      <Row label="Model visible" value={String(props.modelVisible)} />

      <div className="mb-1 mt-2 font-sans font-semibold text-white/70">Tracking</div>
      <Row label="Status" value={props.trackingStatus} />
      <Row label="FPS" value={fmt(props.trackingFps, 1)} />
      <Row label="Left confidence" value={fmt(props.leftConfidence, 2)} />
      <Row label="Right confidence" value={fmt(props.rightConfidence, 2)} />
      <Row label="Foot X (0-1)" value={fmt(props.footX)} />
      <Row label="Foot Y (0-1)" value={fmt(props.footY)} />
      <Row label="Foot screen X" value={props.footScreenX === null ? "—" : `${Math.round(props.footScreenX)}px`} />
      <Row label="Foot screen Y" value={props.footScreenY === null ? "—" : `${Math.round(props.footScreenY)}px`} />
      <Row label="Foot length" value={props.footLengthPx === null ? "—" : `${Math.round(props.footLengthPx)}px`} />
      <Row label="Foot heading (deg)" value={fmt(props.footHeadingDeg, 1)} />

      <div className="mb-1 mt-2 font-sans font-semibold text-white/70">Model Transform</div>
      <Row label="Position X" value={fmt(props.modelPosition?.x ?? null)} />
      <Row label="Position Y" value={fmt(props.modelPosition?.y ?? null)} />
      <Row label="Position Z" value={fmt(props.modelPosition?.z ?? null)} />
      <Row label="Scale" value={fmt(props.modelScale)} />
      <Row label="Rotation Z (deg)" value={fmt(props.modelRotationZDeg, 1)} />

      <div className="mb-1 mt-2 font-sans font-semibold text-white/70">Device</div>
      <Row label="Viewport" value={`${window.innerWidth} × ${window.innerHeight}`} />
      <Row label="Pixel ratio" value={String(window.devicePixelRatio)} />
      <Row label="WebGL2" value={String(!!document.createElement("canvas").getContext("webgl2"))} />
      <div className="mt-1 break-all text-white/40">{ua}</div>
    </div>
  );
}
