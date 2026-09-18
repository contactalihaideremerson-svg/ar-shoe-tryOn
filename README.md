# Virtual Fit — AR Shoe Try-On

A web-based AR shoe virtual try-on app: live camera foot tracking with a real
3D (GLB) shoe model following your feet, plus a Photo Try-On fallback for
devices/browsers that can't run the full live pipeline.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- Three.js + React Three Fiber + drei (3D rendering)
- MediaPipe Tasks Vision — Pose Landmarker (browser-based foot tracking)
- react-router-dom (Home / Try-On routes)

## Getting started

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build to dist/
npm run preview   # preview the production build
```

Camera access requires a secure context. `http://localhost` is exempt from
HTTPS during development; any other host needs HTTPS in production.

That's everything needed for Live AR and plain Photo Try-On. The optional
Hugging Face-enhanced Photo Try-On needs a second, separate server — see
"Optional: AI-enhanced Photo Try-On" below.

## Project structure

```
src/
  components/       # CameraView, ARViewer, ShoeSelector, PhotoTryOn, CalibrationPanel, ...
  data/shoes.ts      # single source of truth for the 6 products + AR calibration
  hooks/             # useCamera, useFootTracking, useARTracking, useShoeModel, ...
  utils/             # shoeAlignment, footGeometry, modelLoader, imageProcessing, smoothing, segmentation
  pages/             # Home.tsx, TryOn.tsx
public/
  models/            # shoe1.glb … shoe6.glb (drop real models here)
  images/            # shoe1.svg … shoe6.svg (placeholder thumbnails)
server/
  index.js           # optional local proxy for the Hugging Face segmentation enhancement
  .env.example        # copy to server/.env and fill in HF_API_TOKEN
```

## Adding your six shoe models

Drop real `.glb`/`.gltf` files into `public/models/` named `shoe1.glb` …
`shoe6.glb` (or update the `model` path in `src/data/shoes.ts`). Nothing else
needs to change — `modelLoader.ts` loads, caches, and normalizes (centers +
uniform-scales) any model automatically, regardless of its original pivot or
scale (e.g. Tripo3D exports).

If a model is missing or fails to parse, the app **does not crash** — it logs
a warning and swaps in a procedurally generated placeholder shoe (a plain,
clearly-stylized shape) so the whole pipeline stays testable before real
assets exist.

Also replace `public/images/shoe1.svg` … `shoe6.svg` with real product
photography (jpg/png/webp) and update `thumbnail` in `shoes.ts`.

## Calibrating each shoe

Every shoe has its own `scale/offsetX/offsetY/offsetZ/rotationX/Y/Z` in
`src/data/shoes.ts` — the AR engine never hard-codes positioning, it always
reads from this config.

To tune a shoe against a real foot:

1. Run the app in dev mode (`npm run dev`) and open **Try-On**.
2. In the header (visible only in dev builds), tap **Debug** to see live
   landmarks/FPS, and **Calibrate** to open the slider panel.
3. Adjust sliders until the shoe sits naturally on your foot.
4. Tap **Copy Calibration JSON** and paste the values into that shoe's entry
   in `src/data/shoes.ts`.

The calibration panel and Debug overlay are gated behind
`import.meta.env.DEV` and are never shown in a production build.

## How foot tracking works (and its limits)

There is no standalone "foot landmarker" generally available in browsers.
This app uses **MediaPipe's Pose Landmarker** (full-body) running entirely
on-device via WebAssembly/WebGL, and reads only the lower-body keypoints it
already provides: ankle, heel, and foot-index (toe) for each leg. From those
three points per foot we derive a meaningful pose — center, heading
(direction), length, and a confidence score — rather than ever placing a shoe
from a bounding box.

Raw landmarks are noisy, so each foot's position, heading, and scale go
through velocity-aware smoothing (heavier smoothing when the foot is still,
lighter when it's moving) plus quaternion slerp for rotation, so the shoe
feels attached rather than jittery.

**Known limitations, by design (not silently faked):**

- **No real depth sensing.** Browsers have no monocular depth API, so
  "distance from camera" is approximated from how large the foot measures in
  the frame relative to a calibration reference. This is a practical
  approximation, not true 3D reconstruction.
- **Occlusion is approximate in Live AR and plain Photo Try-On.** The shoe
  renders on top of the video/photo with no per-pixel leg segmentation, so a
  trouser leg won't correctly cover part of it. Real-time depth-based
  occlusion isn't practically available client-side today. Photo Try-On can
  optionally get pixel-accurate occlusion via the Hugging Face enhancement
  described below — but that's necessarily server-assisted and one-shot, not
  something Live AR's local, real-time loop can use.
- **Pose Landmarker expects a mostly-full-body frame.** Extreme close-ups of
  just a foot can reduce detection confidence, since the underlying model is
  trained on whole-body poses.
- **WebXR is intentionally not used** for the primary experience — device/
  browser support for a foot-tracking WebXR session is not reliably available,
  and the project brief explicitly asks not to depend the whole app on it.

## Optional: AI-enhanced Photo Try-On (Hugging Face)

Photo Try-On (not Live AR — see below for why) can optionally call a free
Hugging Face segmentation model (`mattmdjaga/segformer_b2_clothes`) through a
small local proxy server, and uses it two ways:

- **Occlusion**: masks the person's actual pants/legs back on top of the
  composited shoe wherever they overlap, so a trouser cuff correctly covers
  part of the shoe instead of the shoe floating in front of it.
- **Placement refinement**: if the person is already wearing visible shoes,
  its pixel-accurate mask replaces MediaPipe's sparser 3-point (ankle/heel/toe)
  position and size estimate for that foot — a real photo of the shoe's
  outline is more reliable than a skeletal guess.

**This is entirely optional.** With no backend running (or no token
configured), Photo Try-On works exactly as described above — the enhancement
is fetched in the background, after the shoe is already showing, and just
silently doesn't apply if it's unavailable, slow, or fails for any reason.

### Setup

1. Get a free token at https://huggingface.co/settings/tokens (read access is enough).
2. `cp server/.env.example server/.env` and paste your token into `HF_API_TOKEN`.
3. Run the proxy alongside the normal dev server (two terminals):
   ```bash
   npm run dev      # terminal 1 — the app, http://localhost:5173
   npm run server   # terminal 2 — the proxy, http://localhost:3001
   ```

### Why this only touches Photo Try-On, never Live AR

The project brief is explicit that live tracking must not depend on an
external AI API, and that's a real constraint, not just a rule: an API round
trip is much slower than a 30fps local loop, and it would mean uploading your
live camera feed off-device — directly against the "camera never leaves your
phone" privacy design of Live AR. Photo Try-On is a one-shot, already-idle
moment where that tradeoff is reasonable and the user has already chosen to
share that one photo.

Also worth knowing: Hugging Face's free Inference API can take 10–20+ seconds
to respond the first time a model is called after being idle (a "cold
start"). The app never blocks on this — the plain composite appears
immediately, and the enhancement upgrades it in place if/when it arrives.

## Browser compatibility

- Requires WebGL — checked on load; the app shows a clear error instead of a
  blank/broken screen if it's unavailable.
- Requires `getUserMedia` + a secure context for Live AR. If either is
  missing (or the user denies/lacks a camera), the app automatically offers
  **Photo Try-On** (upload a photo) instead of failing.
- Tested against modern Chrome/Edge (desktop + Android) and Safari
  (desktop + iOS). iOS Safari requires the `playsInline` video attribute
  (already set) to avoid fullscreen takeover.

## Privacy

By default, all video/image processing (pose detection, 3D rendering,
compositing) happens on-device, in the browser — nothing is uploaded
anywhere, for either Live AR or Photo Try-On. Photos are not stored anywhere
by default; they only exist in memory/download until the user saves or
navigates away.

The one exception is opt-in on the developer's side, not the end user's: if
you set up the optional Hugging Face enhancement (see above), a Photo Try-On
image is sent to Hugging Face's Inference API for segmentation. Live AR is
never affected by this — it has no path to any server, with or without that
setup.

## E-commerce / analytics readiness

`src/data/shoes.ts` already carries `price`, `description`, `sku`, and
`sizes` per product so a real catalog/Shopify integration can slot in without
touching the AR engine. `src/utils/analytics.ts` centralizes a small set of
typed events (`shoe_selected`, `try_on_started`, `photo_captured`, etc.) as a
single place to wire up a real analytics provider later — nothing is sent
anywhere today.

## Environment variables

None are required for the core app (everything runs client-side). The
optional Hugging Face enhancement needs one, kept server-side and never in
frontend code:

| Variable | Where | Required for |
|---|---|---|
| `HF_API_TOKEN` | `server/.env` (copy from `server/.env.example`) | Photo Try-On's optional occlusion/placement enhancement only |
| `PORT` | `server/.env` | Optional, defaults to 3001 |

## Known gaps / next steps

- Real `.glb` shoe models and product photography still need to be supplied
  (see "Adding your six shoe models" above).
- Left/right mesh mirroring assumes a single-shoe `.glb` authored as the left
  shoe; if your models already contain both shoes as separate meshes, adjust
  `ShoeInstance`/`ARScene` to select the matching mesh per foot instead of
  mirroring.
- Bundle size: the Try-On route (Three.js + MediaPipe + DRACO) is code-split
  from the landing page already; further splitting (e.g. lazy-loading DRACO
  only when a compressed model is actually used) is a good next optimization
  once real assets are in place.
