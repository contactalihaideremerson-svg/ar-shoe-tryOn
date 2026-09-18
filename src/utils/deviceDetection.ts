/** Capability probes used to decide between Live AR mode and the Photo Try-On fallback. */

export interface DeviceCapabilities {
  hasWebGL: boolean;
  hasGetUserMedia: boolean;
  isSecureContext: boolean;
  isMobile: boolean;
  hasMultipleCameras: boolean | null; // null = unknown until enumerated
  supportsOffscreenCanvas: boolean;
}

let webglCache: boolean | null = null;

export function detectWebGL(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    webglCache = !!gl;
  } catch {
    webglCache = false;
  }
  return webglCache;
}

export function detectGetUserMedia(): boolean {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export function detectSecureContext(): boolean {
  return window.isSecureContext;
}

export function detectMobile(): boolean {
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.innerWidth < 768;
}

export async function detectMultipleCameras(): Promise<boolean> {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return false;
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "videoinput").length > 1;
  } catch {
    return false;
  }
}

export function getDeviceCapabilities(): Omit<DeviceCapabilities, "hasMultipleCameras"> {
  return {
    hasWebGL: detectWebGL(),
    hasGetUserMedia: detectGetUserMedia(),
    isSecureContext: detectSecureContext(),
    isMobile: detectMobile(),
    supportsOffscreenCanvas: typeof OffscreenCanvas !== "undefined",
  };
}

/** True when the browser can realistically run the full live-AR pipeline. */
export function canRunLiveAR(): boolean {
  const caps = getDeviceCapabilities();
  return caps.hasWebGL && caps.hasGetUserMedia && caps.isSecureContext;
}
