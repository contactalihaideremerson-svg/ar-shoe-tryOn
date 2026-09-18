import { useEffect, useState } from "react";

export interface DeviceOrientationState {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  supported: boolean;
}

/**
 * Lightweight device-tilt reading. Not used to drive shoe placement (vision
 * tracking owns that) — reserved for UX touches like nudging the user to
 * hold the phone steadier, or future depth-cue refinements.
 */
export function useDeviceOrientation(enabled: boolean): DeviceOrientationState {
  const [state, setState] = useState<DeviceOrientationState>({
    alpha: null,
    beta: null,
    gamma: null,
    supported: typeof window !== "undefined" && "DeviceOrientationEvent" in window,
  });

  useEffect(() => {
    if (!enabled || !state.supported) return;

    const handler = (event: DeviceOrientationEvent) => {
      setState((prev) => ({
        ...prev,
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
      }));
    };

    window.addEventListener("deviceorientation", handler);
    return () => window.removeEventListener("deviceorientation", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return state;
}
