import type { ShoeCalibration } from "../../types/shoe";

interface CalibrationPanelProps {
  shoeName: string;
  values: ShoeCalibration;
  onChange: (values: ShoeCalibration) => void;
  onClose: () => void;
  onCopyJson: () => void;
}

interface SliderDef {
  key: keyof ShoeCalibration;
  label: string;
  min: number;
  max: number;
  step: number;
}

const SLIDERS: SliderDef[] = [
  { key: "scale", label: "Scale", min: 0.2, max: 3, step: 0.01 },
  { key: "offsetX", label: "X Offset", min: -1, max: 1, step: 0.005 },
  { key: "offsetY", label: "Y Offset", min: -1, max: 1, step: 0.005 },
  { key: "offsetZ", label: "Z Offset", min: -1, max: 1, step: 0.005 },
  { key: "rotationX", label: "Rotation X", min: -180, max: 180, step: 1 },
  { key: "rotationY", label: "Rotation Y", min: -180, max: 180, step: 1 },
  { key: "rotationZ", label: "Rotation Z", min: -180, max: 180, step: 1 },
];

/**
 * Development-only calibration UI. Not shown to end users (gated behind
 * import.meta.env.DEV + an explicit toggle in TryOn.tsx). Lets you dial in
 * per-shoe scale/offset/rotation live, then copy the JSON back into
 * src/data/shoes.ts.
 */
export function CalibrationPanel({ shoeName, values, onChange, onClose, onCopyJson }: CalibrationPanelProps) {
  const set = (key: keyof ShoeCalibration, value: number) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div className="absolute inset-x-2 bottom-2 z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-neutral-700 bg-neutral-900/95 p-4 text-white shadow-2xl backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Calibration — {shoeName}</h3>
        <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white" aria-label="Close calibration panel">
          ✕
        </button>
      </div>
      <div className="space-y-3">
        {SLIDERS.map((slider) => (
          <div key={slider.key}>
            <div className="mb-1 flex justify-between text-[11px] text-neutral-300">
              <span>{slider.label}</span>
              <span className="font-mono">{values[slider.key].toFixed(3)}</span>
            </div>
            <input
              type="range"
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={values[slider.key]}
              onChange={(e) => set(slider.key, parseFloat(e.target.value))}
              className="w-full accent-lime-400"
              aria-label={slider.label}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onCopyJson}
        className="mt-4 w-full rounded-lg bg-lime-400 py-2 text-xs font-semibold text-neutral-900 hover:bg-lime-300"
      >
        Copy Calibration JSON
      </button>
    </div>
  );
}
