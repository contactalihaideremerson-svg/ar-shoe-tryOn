import type { FootSide } from "./shoe";

/** A single normalized 2D/3D landmark as produced by MediaPipe (x,y in [0,1] of frame, z relative depth). */
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

/** Derived, meaningful pose for one foot — never a raw bounding box. */
export interface FootPose {
  side: FootSide;
  /** Normalized [0,1] position of the foot center (mid-point between ankle and toe). */
  center: { x: number; y: number; z: number };
  ankle: { x: number; y: number; z: number };
  heel: { x: number; y: number; z: number };
  toe: { x: number; y: number; z: number };
  /** Foot heading angle in radians, measured in screen space (0 = pointing up/away from camera). */
  heading: number;
  /** Estimated foot length in normalized frame units (ankle/heel to toe distance). */
  length: number;
  /** 0..1 confidence derived from landmark visibility scores. */
  confidence: number;
  /** Rough camera-distance proxy: larger = closer. Derived from foot length + shoulder/hip scale when available. */
  depthScale: number;
}

export type TrackingStatus =
  | "idle"
  | "loading-model"
  | "no-feet"
  | "one-foot"
  | "tracking"
  | "low-confidence"
  | "camera-unavailable"
  | "error";

export interface FootTrackingResult {
  left: FootPose | null;
  right: FootPose | null;
  status: TrackingStatus;
  fps: number;
}
