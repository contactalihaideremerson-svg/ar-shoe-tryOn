/** Centralized product + calibration types for shoe models. */

export interface ShoeCalibration {
  /** Uniform scale multiplier applied after model normalization. */
  scale: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  /** Rotation in degrees around each axis. */
  rotationX: number;
  rotationY: number;
  rotationZ: number;
}

export interface ShoeProduct extends ShoeCalibration {
  id: string;
  name: string;
  model: string;
  thumbnail: string;
  /** Placeholder e-commerce metadata — ready for a real catalog/Shopify integration later. */
  price: number;
  currency: string;
  description: string;
  sku: string;
  sizes: number[];
  colorway?: string;
}

export type FootSide = "left" | "right";
