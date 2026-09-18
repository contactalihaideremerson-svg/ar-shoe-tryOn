import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home";
import { LoadingScreen } from "./components/LoadingScreen/LoadingScreen";

// Three.js/MediaPipe are heavy — keep them out of the landing page's bundle.
const TryOn = lazy(() => import("./pages/TryOn").then((m) => ({ default: m.TryOn })));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="h-dvh w-full">
            <LoadingScreen message="Loading virtual try-on…" />
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/try-on" element={<TryOn />} />
          <Route path="/try-on/:shoeId" element={<TryOn />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
