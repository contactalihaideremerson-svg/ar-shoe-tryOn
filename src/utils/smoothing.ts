import * as THREE from "three";

/**
 * Velocity-aware exponential smoothing (a simplified One-Euro-style filter).
 * Low velocity -> heavier smoothing (kills jitter when the foot is still).
 * High velocity -> lighter smoothing (stays responsive when the foot moves fast).
 */
export class SmoothedVector3 {
  private current: THREE.Vector3 | null = null;
  private lastRaw = new THREE.Vector3();
  private minAlpha: number;
  private maxAlpha: number;

  constructor(minAlpha = 0.15, maxAlpha = 0.65) {
    this.minAlpha = minAlpha;
    this.maxAlpha = maxAlpha;
  }

  update(target: THREE.Vector3, dt: number): THREE.Vector3 {
    if (!this.current) {
      this.current = target.clone();
      this.lastRaw.copy(target);
      return this.current;
    }
    const velocity = target.distanceTo(this.lastRaw) / Math.max(dt, 1 / 120);
    const speedFactor = THREE.MathUtils.clamp(velocity / 2, 0, 1);
    const alpha = THREE.MathUtils.lerp(this.minAlpha, this.maxAlpha, speedFactor);
    this.current.lerp(target, alpha);
    this.lastRaw.copy(target);
    return this.current;
  }

  reset() {
    this.current = null;
  }
}

export class SmoothedQuaternion {
  private current: THREE.Quaternion | null = null;
  private alpha: number;

  constructor(alpha = 0.35) {
    this.alpha = alpha;
  }

  update(target: THREE.Quaternion): THREE.Quaternion {
    if (!this.current) {
      this.current = target.clone();
      return this.current;
    }
    this.current.slerp(target, this.alpha);
    return this.current;
  }

  reset() {
    this.current = null;
  }
}

export class SmoothedScalar {
  private current: number | null = null;
  private alpha: number;

  constructor(alpha = 0.25) {
    this.alpha = alpha;
  }

  update(target: number): number {
    if (this.current === null) {
      this.current = target;
      return this.current;
    }
    this.current = THREE.MathUtils.lerp(this.current, target, this.alpha);
    return this.current;
  }

  reset() {
    this.current = null;
  }
}
