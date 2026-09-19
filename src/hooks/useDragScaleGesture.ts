import { useCallback, useRef } from "react";

/**
 * One-finger drag to nudge X/Y position, two-finger pinch to resize, two-finger
 * twist to rotate — applied directly on top of whatever the automatic foot
 * tracking already computed. This exists because automatic placement can't
 * always get scale/position/orientation perfectly right (no real depth
 * sensor, tracking noise, etc.); rather than only offering that fix through
 * the dev-only CalibrationPanel, this gives every user a direct, physical
 * way to correct it themselves in the moment.
 *
 * Each value here is an OFFSET on top of the tracking-computed transform,
 * never a replacement for it: footPoseToTransform (see shoeAlignment.ts)
 * still computes position/rotation/scale from live tracking every frame,
 * and calibration.offsetX/offsetY/scale/rotationZ (which this hook writes)
 * are added/multiplied on top of that. Tracking keeps running underneath —
 * dragging never overwrites or disables it.
 */

export interface DragScaleValue {
  offsetX: number;
  offsetY: number;
  scale: number;
  rotationZ: number;
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
  const lastPinchAngle = useRef<number | null>(null);
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

  /** Angle (degrees) of the line between the two active pointers. */
  const getPinchAngle = () => {
    const pts = Array.from(pointers.current.values());
    if (pts.length < 2) return null;
    return (Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) * 180) / Math.PI;
  };

  /** Shortest signed distance from `a` to `b` in degrees, handling the ±180 wraparound. */
  const angleDelta = (a: number, b: number) => {
    let d = b - a;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return d;
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
    lastPinchAngle.current = getPinchAngle();
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const midpoint = getMidpoint();
      const pinchDistance = getPinchDistance();
      const pinchAngle = getPinchAngle();
      const current = latestValue.current;

      if (pointers.current.size >= 2 && pinchDistance && lastPinchDistance.current && pinchAngle !== null && lastPinchAngle.current !== null) {
        const ratio = pinchDistance / lastPinchDistance.current;
        const nextScale = Math.min(maxScale, Math.max(minScale, current.scale * ratio));
        const rotationDelta = angleDelta(lastPinchAngle.current, pinchAngle);
        const next = { ...current, scale: nextScale, rotationZ: current.rotationZ + rotationDelta };
        // Update the cache immediately rather than waiting for this value to
        // come back through a React re-render: two touch points each fire
        // their own pointermove, and on browsers/timings where both land in
        // the same tick (no render in between), the second one must see the
        // first one's result as its base — otherwise its absolute output
        // silently clobbers the first's instead of composing with it.
        latestValue.current = next;
        onChange(next);
      } else if (pointers.current.size === 1 && midpoint && lastMidpoint.current) {
        const dxPx = midpoint.x - lastMidpoint.current.x;
        const dyPx = midpoint.y - lastMidpoint.current.y;
        const next = {
          ...current,
          offsetX: current.offsetX + dxPx * worldUnitsPerPixelX,
          // Screen Y grows downward; world Y grows upward.
          offsetY: current.offsetY - dyPx * worldUnitsPerPixelY,
        };
        latestValue.current = next;
        onChange(next);
      }

      lastMidpoint.current = midpoint;
      lastPinchDistance.current = pinchDistance;
      lastPinchAngle.current = pinchAngle;
    },
    [onChange, worldUnitsPerPixelX, worldUnitsPerPixelY, minScale, maxScale]
  );

  const endPointer = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    lastMidpoint.current = getMidpoint();
    lastPinchDistance.current = getPinchDistance();
    lastPinchAngle.current = getPinchAngle();
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
