import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "../components/Header/Header";
import { ARHeader } from "../components/Header/ARHeader";
import { CameraView } from "../components/CameraView/CameraView";
import { ARViewer } from "../components/ARViewer/ARViewer";
import { ARShoeCarousel } from "../components/ShoeSelector/ARShoeCarousel";
import { AROverlayCard } from "../components/ARViewer/AROverlayCard";
import { ARAdjustControls } from "../components/ARViewer/ARAdjustControls";
import { HelpModal } from "../components/ARViewer/HelpModal";
import { PermissionScreen } from "../components/PermissionScreen/PermissionScreen";
import { TrackingStatusPill } from "../components/FootTracker/TrackingStatusPill";
import { DebugOverlay } from "../components/FootTracker/DebugOverlay";
import { DebugPanel } from "../components/DebugPanel/DebugPanel";
import { CalibrationPanel } from "../components/CalibrationPanel/CalibrationPanel";
import { PhotoTryOnView } from "../components/PhotoTryOn/PhotoTryOnView";
import { ErrorState } from "../components/ErrorState/ErrorState";
import { LoadingScreen } from "../components/LoadingScreen/LoadingScreen";
import { useCamera } from "../hooks/useCamera";
import { useARTracking } from "../hooks/useARTracking";
import { useDragScaleGesture } from "../hooks/useDragScaleGesture";
import { useShoeModel } from "../hooks/useShoeModel";
import { shoes, getShoeById } from "../data/shoes";
import { preloadShoeModel } from "../utils/modelLoader";
import { captureVideoFrame, readFileAsImage, validateUploadedFile } from "../utils/imageProcessing";
import { canRunLiveAR, detectWebGL } from "../utils/deviceDetection";
import { computeViewportPlane, footPoseToTransform } from "../utils/shoeAlignment";
import { trackEvent } from "../utils/analytics";
import type { ShoeProduct, ShoeCalibration } from "../types/shoe";

type ScreenState = "checking" | "fatal-webgl" | "unsupported-live" | "permission" | "live" | "photo-review";
type PhotoSource = "capture" | "upload";

// Icons for the AROverlayCard states on the live AR screen.
const FOOT_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M8 3c1.5 0 2 1.5 2 3s-.5 3 .5 4.5S13 13 13 15.5c0 2.5-1.8 4.5-4.5 4.5S3 18.3 3 15.5c0-1.7.5-2.3.5-4S3 8 3 6.5C3 4.6 5 3 8 3Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M13 16c1.8 0 3 .5 5 .5s3.5-.5 4.5.8-.3 2.7-2 2.7H10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SPINNER_ICON = <span className="block h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />;
const WARNING_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function TryOn() {
  const { shoeId } = useParams();
  const navigate = useNavigate();

  const initialShoe = useMemo(() => getShoeById(shoeId ?? "") ?? shoes[0], [shoeId]);
  const [selectedShoe, setSelectedShoe] = useState<ShoeProduct>(initialShoe);
  const [screenState, setScreenState] = useState<ScreenState>("checking");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [photoSource, setPhotoSource] = useState<PhotoSource>("capture");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [calibrationOverrides, setCalibrationOverrides] = useState<Record<string, ShoeCalibration>>({});

  // `?debug=true` unlocks the full AR diagnostic panel (and the dev-only
  // Debug/Calibrate toggles) on a deployed build too, without needing a dev
  // server — the whole point being to diagnose a real device/browser rather
  // than only ever being able to check this in local dev.
  const debugQueryEnabled = useMemo(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "true",
    []
  );
  const canShowDevTools = import.meta.env.DEV || debugQueryEnabled;
  const [showDebugPanel, setShowDebugPanel] = useState(debugQueryEnabled);
  const [modelTestMode, setModelTestMode] = useState(false);
  const [forceHideModel, setForceHideModel] = useState(false);
  const [liveCanvasSize, setLiveCanvasSize] = useState({ width: 0, height: 0 });

  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [helpDontShowAgain, setHelpDontShowAgain] = useState(() => {
    try {
      return localStorage.getItem("arHelpDontShowAgain") === "true";
    } catch {
      return false;
    }
  });
  const handleDontShowAgainChange = useCallback((value: boolean) => {
    setHelpDontShowAgain(value);
    try {
      localStorage.setItem("arHelpDontShowAgain", String(value));
    } catch {
      // Private/blocked storage — the preference just won't persist across sessions.
    }
  }, []);
  // Auto-surface the gesture guide once per session the first time the live
  // AR screen is reached, unless the user has previously dismissed it for
  // good — a ref (not state) so re-entering "live" after a retake/back
  // navigation doesn't pop it again mid-session.
  const hasAutoShownHelp = useRef(false);
  useEffect(() => {
    if (screenState === "live" && !hasAutoShownHelp.current && !helpDontShowAgain) {
      hasAutoShownHelp.current = true;
      setHelpModalOpen(true);
    }
  }, [screenState, helpDontShowAgain]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoWrapperRef = useRef<HTMLDivElement>(null);

  const camera = useCamera("environment");
  const shoeIndex = shoes.findIndex((s) => s.id === selectedShoe.id);
  const effectiveShoe: ShoeProduct = {
    ...selectedShoe,
    ...(calibrationOverrides[selectedShoe.id] ?? {}),
  };

  const tracking = useARTracking(camera.videoRef.current, screenState === "live" && camera.isReady);
  // Dedicated instance purely to drive the 2D "Loading shoe…" / "Unable to
  // load" UI and the debug panel — separate from the clones ShoeInstance
  // loads for actual rendering, but backed by the same cache, so this adds
  // no extra network/parse work.
  const shoeModelUi = useShoeModel(screenState === "live" ? effectiveShoe.model : null);
  const [videoAspect, setVideoAspect] = useState(16 / 9);

  // One-finger drag to nudge position, two-finger pinch/twist to resize and
  // rotate — a direct, physical way for the user to correct placement
  // themselves, since automatic tracking has no real depth sensor and won't
  // always get scale/position/orientation exactly right. Writes into the
  // same per-shoe calibration override the dev-only CalibrationPanel uses,
  // so both paths compose. This is strictly additive on top of tracking:
  // footPoseToTransform still computes position/rotation/scale from live
  // tracking every frame; these overrides are the offsetX/offsetY/scale/
  // rotationZ added on top (see shoeAlignment.ts), never a replacement.
  const hasManualAdjustment = selectedShoe.id in calibrationOverrides;
  const liveViewport = computeViewportPlane(videoAspect, camera.facingMode === "user");
  const wrapperRect = videoWrapperRef.current?.getBoundingClientRect();
  const applyAdjustment = useCallback(
    (next: Partial<ShoeCalibration>) => {
      setCalibrationOverrides((prev) => {
        // Bases the merge on `prev` (the functional updater's always-current
        // state) rather than the `effectiveShoe` closed over at render time,
        // which would go stale across rapid-fire calls (e.g. two quick
        // button taps before React re-renders in between).
        const base: ShoeCalibration = { ...selectedShoe, ...prev[selectedShoe.id] };
        return { ...prev, [selectedShoe.id]: { ...base, ...next } };
      });
    },
    [selectedShoe]
  );
  const dragScale = useDragScaleGesture({
    value: {
      offsetX: effectiveShoe.offsetX,
      offsetY: effectiveShoe.offsetY,
      scale: effectiveShoe.scale,
      rotationZ: effectiveShoe.rotationZ,
    },
    onChange: applyAdjustment,
    worldUnitsPerPixelX: wrapperRect && wrapperRect.width > 0 ? liveViewport.width / wrapperRect.width : 0,
    worldUnitsPerPixelY: wrapperRect && wrapperRect.height > 0 ? liveViewport.height / wrapperRect.height : 0,
  });
  const resetManualAdjustment = useCallback(() => {
    setCalibrationOverrides((prev) => {
      const next = { ...prev };
      delete next[selectedShoe.id];
      return next;
    });
  }, [selectedShoe.id]);
  // These read/modify state via the functional updater (not the `effectiveShoe`
  // closure) so two rapid taps in a row both land correctly instead of the
  // second one clobbering the first with a stale base value.
  const rotateBy = useCallback(
    (deltaDeg: number) => {
      setCalibrationOverrides((prev) => {
        const base: ShoeCalibration = { ...selectedShoe, ...prev[selectedShoe.id] };
        return { ...prev, [selectedShoe.id]: { ...base, rotationZ: base.rotationZ + deltaDeg } };
      });
    },
    [selectedShoe]
  );
  const zoomBy = useCallback(
    (factor: number) => {
      setCalibrationOverrides((prev) => {
        const base: ShoeCalibration = { ...selectedShoe, ...prev[selectedShoe.id] };
        return { ...prev, [selectedShoe.id]: { ...base, scale: Math.min(4, Math.max(0.2, base.scale * factor)) } };
      });
    },
    [selectedShoe]
  );

  // Capability check on mount.
  useEffect(() => {
    if (!detectWebGL()) {
      setScreenState("fatal-webgl");
      return;
    }
    if (!canRunLiveAR()) {
      setScreenState("unsupported-live");
      return;
    }
    setScreenState("permission");
  }, []);

  // Preload thumbnails eagerly (browser does this via <img>), and warm the next shoe's 3D model.
  useEffect(() => {
    const next = shoes[(shoeIndex + 1) % shoes.length];
    if (next) preloadShoeModel(next.model);
  }, [shoeIndex]);

  useEffect(() => {
    const video = camera.videoRef.current;
    if (!video) return;
    const update = () => {
      if (video.videoWidth && video.videoHeight) setVideoAspect(video.videoWidth / video.videoHeight);
    };
    // The stream can already be attached (and its metadata already loaded)
    // by the time this effect runs — the video element mounts and gets its
    // srcObject via a ref callback during React's commit phase, which
    // happens before this passive effect. Relying solely on the
    // "loadedmetadata" event risks missing it entirely and getting stuck on
    // the 16:9 default forever, which then feeds a wrong aspect ratio into
    // every shoe position/scale calculation. Check immediately, and also
    // listen for both the metadata event and later resize (e.g. camera
    // switch) as a fallback.
    update();
    video.addEventListener("loadedmetadata", update);
    video.addEventListener("resize", update);
    return () => {
      video.removeEventListener("loadedmetadata", update);
      video.removeEventListener("resize", update);
    };
  }, [camera.videoRef, screenState]);

  const handleEnableCamera = useCallback(async () => {
    await camera.requestCamera();
  }, [camera]);

  useEffect(() => {
    if (camera.permission === "granted" && screenState === "permission") {
      setScreenState("live");
      trackEvent({ name: "try_on_started", mode: "live" });
    }
  }, [camera.permission, screenState]);

  const openUploadPicker = useCallback(() => {
    setUploadError(null);
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const validation = validateUploadedFile(file);
    if (!validation.valid) {
      setUploadError(validation.reason ?? "Invalid file.");
      return;
    }
    try {
      const { dataUrl } = await readFileAsImage(file);
      setCapturedImage(dataUrl);
      setPhotoSource("upload");
      setScreenState("photo-review");
      trackEvent({ name: "try_on_started", mode: "photo" });
    } catch {
      setUploadError("That file doesn't look like a valid image.");
    }
  }, []);

  const handleCapture = useCallback(() => {
    const video = camera.videoRef.current;
    if (!video) return;
    const { dataUrl } = captureVideoFrame(video, camera.facingMode === "user");
    setCapturedImage(dataUrl);
    setPhotoSource("capture");
    setScreenState("photo-review");
    trackEvent({ name: "photo_captured", shoeId: selectedShoe.id });
  }, [camera, selectedShoe.id]);

  const handleSelectShoe = useCallback(
    (shoe: ShoeProduct) => {
      if (shoe.id !== selectedShoe.id) {
        trackEvent({ name: "shoe_switched", fromShoeId: selectedShoe.id, toShoeId: shoe.id });
      }
      setSelectedShoe(shoe);
      trackEvent({ name: "shoe_selected", shoeId: shoe.id });
    },
    [selectedShoe.id]
  );

  const handleRetake = useCallback(() => {
    if (photoSource === "capture") {
      setScreenState("live");
      setCapturedImage(null);
    } else {
      setCapturedImage(null);
      openUploadPicker();
    }
  }, [photoSource, openUploadPicker]);

  const handleBackToCamera = useCallback(() => {
    setCapturedImage(null);
    setScreenState(camera.permission === "granted" ? "live" : "permission");
  }, [camera.permission]);

  const hiddenFileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/jpeg,image/jpg,image/png,image/webp"
      className="hidden"
      onChange={handleFileChange}
      aria-hidden="true"
    />
  );

  if (screenState === "checking") {
    return (
      <div className="h-dvh w-full">
        <LoadingScreen message="Checking your device…" />
      </div>
    );
  }

  if (screenState === "fatal-webgl") {
    return (
      <div className="flex h-dvh w-full flex-col">
        <Header title="Virtual Try-On" showBack />
        <div className="flex-1">
          <ErrorState
            title="Your browser can't render 3D"
            message="This experience needs WebGL. Please try a recent version of Chrome, Safari, or Edge."
            actionLabel="Go Back"
            onAction={() => navigate("/")}
          />
        </div>
      </div>
    );
  }

  if (screenState === "photo-review" && capturedImage) {
    return (
      <div className="h-dvh w-full bg-black">
        <PhotoTryOnView
          imageDataUrl={capturedImage}
          shoe={effectiveShoe}
          onRetake={handleRetake}
          onBackToCamera={handleBackToCamera}
          canReturnToCamera={canRunLiveAR()}
        />
        {hiddenFileInput}
      </div>
    );
  }

  if (screenState === "unsupported-live") {
    return (
      <div className="flex h-dvh w-full flex-col bg-neutral-950 text-white">
        <Header title="Virtual Try-On" showBack />
        <div className="flex-1">
          <ErrorState
            icon="upload"
            title="Photo Try-On Available"
            message="Your browser doesn't support full real-time AR. You can still see the shoes on a photo of your feet."
            actionLabel="Upload a Photo"
            onAction={openUploadPicker}
          />
        </div>
        <div className="border-t border-white/10 py-3">
          <ARShoeCarousel selectedId={selectedShoe.id} onSelect={handleSelectShoe} />
        </div>
        {uploadError && <p className="px-6 pb-4 text-center text-xs text-red-400">{uploadError}</p>}
        {hiddenFileInput}
      </div>
    );
  }

  if (screenState === "permission") {
    return (
      <div className="flex h-dvh w-full flex-col">
        <Header title="Virtual Try-On" showBack />
        <div className="flex-1">
          <PermissionScreen
            onEnableCamera={handleEnableCamera}
            onUsePhotoInstead={openUploadPicker}
            requesting={camera.permission === "requesting"}
            error={camera.error}
          />
        </div>
        {uploadError && <p className="px-6 pb-4 text-center text-xs text-red-400">{uploadError}</p>}
        {hiddenFileInput}
      </div>
    );
  }

  // Live AR
  const trackingFatal = tracking.status === "error";
  const shoeHasError = !!shoeModelUi.error && !shoeModelUi.loading;
  const overlayCard = trackingFatal
    ? null
    : shoeHasError
    ? {
        tone: "error" as const,
        title: "Unable to load this shoe",
        subtitle:
          debugQueryEnabled || import.meta.env.DEV
            ? shoeModelUi.error!.message
            : "There was a problem loading the 3D model.",
        icon: WARNING_ICON,
        action: { label: "Retry", onClick: shoeModelUi.reload },
      }
    : shoeModelUi.loading
    ? { tone: "neutral" as const, title: "Loading Shoe…", subtitle: "This may take a few seconds", icon: SPINNER_ICON }
    : tracking.status === "idle" || tracking.status === "loading-model"
    ? { tone: "neutral" as const, title: "Point your camera at your feet", subtitle: undefined, icon: FOOT_ICON }
    : tracking.status === "no-feet" || tracking.status === "camera-unavailable"
    ? {
        tone: "neutral" as const,
        title: "Place your foot inside the frame",
        subtitle: "Make sure your feet are clearly visible and well lit.",
        icon: FOOT_ICON,
      }
    : null;
  const canUseThisLook = camera.isReady && !shoeModelUi.loading && !shoeHasError && !trackingFatal;

  return (
    <div className="flex h-dvh w-full flex-col bg-black">
      <div
        ref={videoWrapperRef}
        className="relative flex-1 touch-none select-none overflow-hidden"
        {...dragScale.handlers}
      >
        <CameraView ref={camera.setVideoEl} mirrored={camera.facingMode === "user"} />

        <ARViewer
          shoe={effectiveShoe}
          leftPoseRef={tracking.leftPoseRef}
          rightPoseRef={tracking.rightPoseRef}
          aspect={videoAspect}
          mirrored={camera.facingMode === "user"}
          modelTestMode={modelTestMode}
          forceHidden={forceHideModel}
          preserveDrawingBuffer={debugQueryEnabled}
          onCanvasReady={(canvas) => setLiveCanvasSize({ width: canvas.width, height: canvas.height })}
        />

        <ARHeader title="Try On" onClose={() => navigate(-1)} onHelp={() => setHelpModalOpen(true)}>
          <TrackingStatusPill status={tracking.status} />
        </ARHeader>

        {canShowDevTools && (
          <div className="pointer-events-auto absolute right-3 top-16 z-40 flex gap-1">
            <button
              type="button"
              onClick={() => setDebugMode((v) => !v)}
              className={["rounded-full px-2.5 py-1 text-[11px] font-medium", debugMode ? "bg-lime-400 text-black" : "bg-black/50 text-white"].join(" ")}
            >
              Debug
            </button>
            <button
              type="button"
              onClick={() => setCalibrationOpen((v) => !v)}
              className={["rounded-full px-2.5 py-1 text-[11px] font-medium", calibrationOpen ? "bg-lime-400 text-black" : "bg-black/50 text-white"].join(" ")}
            >
              Calibrate
            </button>
            <button
              type="button"
              onClick={() => setShowDebugPanel((v) => !v)}
              className={["rounded-full px-2.5 py-1 text-[11px] font-medium", showDebugPanel ? "bg-lime-400 text-black" : "bg-black/50 text-white"].join(" ")}
            >
              AR Debug
            </button>
          </div>
        )}

        {/* Real 3D-model loading/error state and tracking hints, surfaced as
            actual 2D UI instead of silently substituting a placeholder shape
            — a failed or still-loading GLB must be visibly a failed/loading
            GLB, and "no foot yet" must be visibly that, not a blank screen. */}
        {overlayCard && (
          <AROverlayCard
            tone={overlayCard.tone}
            title={overlayCard.title}
            subtitle={overlayCard.subtitle}
            icon={overlayCard.icon}
            action={overlayCard.action}
          />
        )}

        {trackingFatal && (
          <div className="absolute inset-0 overflow-y-auto bg-black/90">
            <ErrorState
              icon="warning"
              title="AR tracking unavailable"
              message="Foot tracking couldn't start — this usually means a slow or blocked connection while loading the tracking model. Check your connection and try again, or use Photo Try-On instead."
              actionLabel="Try Again"
              onAction={() => window.location.reload()}
              secondaryLabel="Try With Photo Instead"
              onSecondary={openUploadPicker}
            />
          </div>
        )}

        {debugMode && (
          <DebugOverlay
            left={tracking.left}
            right={tracking.right}
            fps={tracking.fps}
            shoeId={selectedShoe.id}
            mirrored={camera.facingMode === "user"}
            videoWidth={camera.videoRef.current?.videoWidth ?? 0}
            videoHeight={camera.videoRef.current?.videoHeight ?? 0}
          />
        )}

        {calibrationOpen && (
          <CalibrationPanel
            shoeName={selectedShoe.name}
            values={effectiveShoe}
            onChange={(values) =>
              setCalibrationOverrides((prev) => ({ ...prev, [selectedShoe.id]: values }))
            }
            onClose={() => setCalibrationOpen(false)}
            onCopyJson={() => {
              const { scale, offsetX, offsetY, offsetZ, rotationX, rotationY, rotationZ } = effectiveShoe;
              const json = JSON.stringify({ scale, offsetX, offsetY, offsetZ, rotationX, rotationY, rotationZ }, null, 2);
              navigator.clipboard?.writeText(json).catch(() => undefined);
            }}
          />
        )}

        {canShowDevTools && showDebugPanel && (
          <DebugPanel
            cameraPermission={camera.permission}
            cameraError={camera.error}
            facingMode={camera.facingMode}
            videoWidth={camera.videoRef.current?.videoWidth ?? 0}
            videoHeight={camera.videoRef.current?.videoHeight ?? 0}
            canvasWidth={liveCanvasSize.width}
            canvasHeight={liveCanvasSize.height}
            selectedShoeName={selectedShoe.name}
            modelUrl={effectiveShoe.model}
            modelLoading={shoeModelUi.loading}
            modelError={shoeModelUi.error?.message ?? null}
            modelVisible={!forceHideModel && !!shoeModelUi.scene && (modelTestMode || !!tracking.left || !!tracking.right)}
            trackingStatus={tracking.status}
            trackingFps={tracking.fps}
            leftConfidence={tracking.left?.confidence ?? null}
            rightConfidence={tracking.right?.confidence ?? null}
            footX={tracking.left?.center.x ?? tracking.right?.center.x ?? null}
            footY={tracking.left?.center.y ?? tracking.right?.center.y ?? null}
            footHeadingDeg={
              tracking.left ? (tracking.left.heading * 180) / Math.PI : tracking.right ? (tracking.right.heading * 180) / Math.PI : null
            }
            modelPosition={
              tracking.left
                ? footPoseToTransform(tracking.left, effectiveShoe, computeViewportPlane(videoAspect, camera.facingMode === "user")).position
                : null
            }
            modelScale={
              tracking.left
                ? footPoseToTransform(tracking.left, effectiveShoe, computeViewportPlane(videoAspect, camera.facingMode === "user")).scale
                : null
            }
            modelRotationZDeg={effectiveShoe.rotationZ}
            modelTestMode={modelTestMode}
            onToggleModelTest={() => setModelTestMode((v) => !v)}
            forceHidden={forceHideModel}
            onToggleHidden={() => setForceHideModel((v) => !v)}
            onReloadCamera={() => void camera.requestCamera()}
            onReloadModel={shoeModelUi.reload}
            onResetTracking={tracking.reload}
            onResetShoe={resetManualAdjustment}
            onClose={() => setShowDebugPanel(false)}
          />
        )}

        {helpModalOpen && (
          <HelpModal
            onClose={() => setHelpModalOpen(false)}
            dontShowAgain={helpDontShowAgain}
            onDontShowAgainChange={handleDontShowAgainChange}
          />
        )}

        {!trackingFatal && (
          <div className="safe-bottom pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-4 bg-gradient-to-t from-black/85 via-black/50 to-transparent pb-4 pt-10">
            <div className="pointer-events-auto">
              <ARShoeCarousel selectedId={selectedShoe.id} onSelect={handleSelectShoe} />
            </div>
            <div className="pointer-events-auto">
              <ARAdjustControls
                onRotateLeft={() => rotateBy(-15)}
                onZoomOut={() => zoomBy(1 / 1.1)}
                onReset={resetManualAdjustment}
                onZoomIn={() => zoomBy(1.1)}
                onRotateRight={() => rotateBy(15)}
                resetDisabled={!hasManualAdjustment}
              />
            </div>
            <div className="pointer-events-auto px-4">
              <button
                type="button"
                onClick={handleCapture}
                disabled={!canUseThisLook}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 disabled:opacity-40"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Use This Look
              </button>
            </div>
          </div>
        )}
      </div>

      {uploadError && <p className="bg-black px-6 py-3 text-center text-xs text-red-400">{uploadError}</p>}
      {hiddenFileInput}
    </div>
  );
}
