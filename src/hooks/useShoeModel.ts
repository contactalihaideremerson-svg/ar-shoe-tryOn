import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { loadShoeModel, disposeShoeInstance } from "../utils/modelLoader";

interface UseShoeModelResult {
  scene: THREE.Group | null;
  loading: boolean;
  /** The load error, or null if none. Exposed (not just a boolean) so the UI/console can show what actually went wrong. */
  error: Error | null;
  /** Re-attempts the load for the current url from scratch (bypasses the failed cache entry). */
  reload: () => void;
}

/**
 * Loads (from the shared cache) a fresh clone of the shoe at `url` for this
 * component instance. Never falls back to a placeholder on failure — `error`
 * is the real GLTFLoader error, for the caller to show and let the user
 * retry, per the "don't fake a working model" requirement.
 */
export function useShoeModel(url: string | null): UseShoeModelResult {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const currentInstance = useRef<THREE.Group | null>(null);

  useEffect(() => {
    // Clear immediately, synchronously with the url change — not after the
    // new model resolves. Otherwise the previous (about-to-be-disposed, once
    // this effect's cleanup runs) instance stays visible/rendered while the
    // new one is still loading, which is exactly the "shows the previous
    // shoe while loading" behavior this must not have.
    setScene(null);

    if (!url) {
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    loadShoeModel(url)
      .then((instance) => {
        if (cancelled) {
          disposeShoeInstance(instance);
          return;
        }
        currentInstance.current = instance;
        setScene(instance);
      })
      .catch((err) => {
        const wrapped = err instanceof Error ? err : new Error(String(err));
        console.error(`[useShoeModel] Failed to load "${url}":`, wrapped);
        if (!cancelled) setError(wrapped);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (currentInstance.current) {
        disposeShoeInstance(currentInstance.current);
        currentInstance.current = null;
      }
    };
  }, [url, retryToken]);

  const reload = useCallback(() => setRetryToken((n) => n + 1), []);

  return { scene, loading, error, reload };
}
