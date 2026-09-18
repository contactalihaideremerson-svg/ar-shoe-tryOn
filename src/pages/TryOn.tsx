import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "../components/Header/Header";
import { CameraView } from "../components/CameraView/CameraView";
import { ARViewer } from "../components/ARViewer/ARViewer";
import { ShoeSelector } from "../components/ShoeSelector/ShoeSelector";
import { BottomControls } from "../components/BottomControls/BottomControls";
import { PermissionScreen } from "../components/PermissionScreen/PermissionScreen";
import { TrackingStatusPill } from "../components/FootTracker/TrackingStatusPill";
import { DebugOverlay } from "../components/FootTracker/DebugOverlay";
import { CalibrationPanel } from "../components/CalibrationPanel/CalibrationPanel";
import { PhotoTryOnView } from "../components/PhotoTryOn/PhotoTryOnView";
import { ErrorState } from "../components/ErrorState/ErrorState";
import { LoadingScreen } from "../components/LoadingScreen/LoadingScreen";
import { useCamera } from "../hooks/useCamera";
import { useARTracking } from "../hooks/useARTracking";
import { shoes, getShoeById } from "../data/shoes";
import { preloadShoeModel } from "../utils/modelLoader";
import { captureVideoFrame, readFileAsImage, validateUploadedFile } from "../utils/imageProcessing";
import { canRunLiveAR, detectWebGL } from "../utils/deviceDetection";
import { trackEvent } from "../utils/analytics";
import type { ShoeProduct, ShoeCalibration } from "../types/shoe";

type ScreenState = "checking" | "fatal-webgl" | "unsupported-live" | "permission" | "live" | "photo-review";
type PhotoSource = "capture" | "upload";

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoWrapperRef = useRef<HTMLDivElement>(null);

  const camera = useCamera("environment");
  const shoeIndex = shoes.findIndex((s) => s.id === selectedShoe.id);
  const effectiveShoe: ShoeProduct = {
    ...selectedShoe,
    ...(calibrationOverrides[selectedShoe.id] ?? {}),
  };

  const tracking = useARTracking(camera.videoRef.current, screenState === "live" && camera.isReady);

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
    if (next) preloadShoeModel(next.model, shoes.indexOf(next));
  }, [shoeIndex]);

  const [videoAspect, setVideoAspect] = useState(16 / 9);
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
      <div className="flex h-dvh w-full flex-col">
        <Header title="Photo Try-On" showBack />
        <div className="flex-1 overflow-hidden">
          <PhotoTryOnView
            imageDataUrl={capturedImage}
            shoe={effectiveShoe}
            shoeIndex={shoeIndex}
            onSelectShoe={handleSelectShoe}
            onRetake={handleRetake}
            onBackToCamera={handleBackToCamera}
            canReturnToCamera={canRunLiveAR()}
          />
        </div>
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
        <div className="border-t border-white/10 py-2">
          <ShoeSelector selectedId={selectedShoe.id} onSelect={handleSelectShoe} compact />
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
  return (
    <div className="flex h-dvh w-full flex-col bg-black">
      <Header
        title="Virtual Try-On"
        showBack
        right={
          import.meta.env.DEV ? (
            <>
              <button
                type="button"
                onClick={() => setDebugMode((v) => !v)}
                className={["rounded-full px-2.5 py-1 text-[11px] font-medium", debugMode ? "bg-lime-400 text-black" : "bg-neutral-100 text-neutral-600"].join(" ")}
              >
                Debug
              </button>
              <button
                type="button"
                onClick={() => setCalibrationOpen((v) => !v)}
                className={["rounded-full px-2.5 py-1 text-[11px] font-medium", calibrationOpen ? "bg-lime-400 text-black" : "bg-neutral-100 text-neutral-600"].join(" ")}
              >
                Calibrate
              </button>
            </>
          ) : undefined
        }
      />

      <div ref={videoWrapperRef} className="relative flex-1 overflow-hidden">
        <CameraView ref={camera.setVideoEl} mirrored={camera.facingMode === "user"} />

        <ARViewer
          shoe={effectiveShoe}
          shoeIndex={shoeIndex}
          leftPoseRef={tracking.leftPoseRef}
          rightPoseRef={tracking.rightPoseRef}
          aspect={videoAspect}
          mirrored={camera.facingMode === "user"}
        />

        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2">
          <TrackingStatusPill status={tracking.status} />
        </div>

        {tracking.status === "error" && (
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
      </div>

      <div className="border-t border-white/10 bg-black py-2">
        <ShoeSelector selectedId={selectedShoe.id} onSelect={handleSelectShoe} />
      </div>
      <div className="safe-bottom bg-black">
        <BottomControls
          onCapture={handleCapture}
          onSwitchCamera={camera.switchCamera}
          onUploadClick={openUploadPicker}
          canSwitchCamera
          captureDisabled={!camera.isReady}
        />
      </div>
      {uploadError && <p className="bg-black px-6 pb-3 text-center text-xs text-red-400">{uploadError}</p>}
      {hiddenFileInput}
    </div>
  );
}
