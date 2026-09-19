import { useCallback, useRef } from "react";

/**
 * One-finger drag to nudge X/Y position, two-finger pinch to resize — applied
 * directly on top of whatever the automatic foot tracking already computed.
 * This exists because automatic placement can't always get scale/position
 * perfectly right (no real depth sensor, tracking noise, etc.); rather than
 * only offering that fix through the dev-only CalibrationPanel, this gives
 * every user a direct, physical way to correct it themselves in the moment.
 */

export interface DragScaleValue {
  offsetX: number;
  offsetY: number;
  scale: number;
}

interface UseDragScaleGestureOptions {
  /** Current committed value (e.g. the selected shoe's calibration). */
  value: DragScaleValue;
  onChange: (next: DragScaleValue) => void;
  /** World units per screen pixel, for converting drag distance into offset units. */
  worldUnitsPerPixelX: number;
  worldUnitsPerPixelY: number;
  minScale?: number;
  maxScale?: number;
}

export function useDragScaleGesture({
  value,
  onChange,
  worldUnitsPerPixelX,
  worldUnitsPerPixelY,
  minScale = 0.2,
  maxScale = 4,
}: UseDragScaleGestureOptions) {
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastMidpoint = useRef<{ x: number; y: number } | null>(null);
  const lastPinchDistance = useRef<number | null>(null);
  const latestValue = useRef(value);
  latestValue.current = value;

  const getMidpoint = () => {
    const pts = Array.from(pointers.current.values());
    if (pts.length === 0) return null;
    const x = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
    const y = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
    return { x, y };
  };

  const getPinchDistance = () => {
    const pts = Array.from(pointers.current.values());
    if (pts.length < 2) return null;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  };

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    try {
      // Not all environments/pointer types support capture (or accept it for
      // a given pointer at this moment); losing capture just means a drag
      // that leaves the element bounds stops updating, which degrades
      // gracefully rather than breaking the gesture.
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      // Ignored — see above.
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lastMidpoint.current = getMidpoint();
    lastPinchDistance.current = getPinchDistance();
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const midpoint = getMidpoint();
      const pinchDistance = getPinchDistance();
      const current = latestValue.current;

      if (pointers.current.size >= 2 && pinchDistance && lastPinchDistance.current) {
        const ratio = pinchDistance / lastPinchDistance.current;
        const nextScale = Math.min(maxScale, Math.max(minScale, current.scale * ratio));
        onChange({ ...current, scale: nextScale });
      } else if (pointers.current.size === 1 && midpoint && lastMidpoint.current) {
        const dxPx = midpoint.x - lastMidpoint.current.x;
        const dyPx = midpoint.y - lastMidpoint.current.y;
        onChange({
          ...current,
          offsetX: current.offsetX + dxPx * worldUnitsPerPixelX,
          // Screen Y grows downward; world Y grows upward.
          offsetY: current.offsetY - dyPx * worldUnitsPerPixelY,
        });
      }

      lastMidpoint.current = midpoint;
      lastPinchDistance.current = pinchDistance;
    },
    [onChange, worldUnitsPerPixelX, worldUnitsPerPixelY, minScale, maxScale]
  );

  const endPointer = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    lastMidpoint.current = getMidpoint();
    lastPinchDistance.current = getPinchDistance();
  }, []);

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
    },
  };
}
