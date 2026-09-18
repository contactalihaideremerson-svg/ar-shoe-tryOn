import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { loadShoeModel, disposeShoeInstance } from "../utils/modelLoader";

interface UseShoeModelResult {
  scene: THREE.Group | null;
  loading: boolean;
  error: boolean;
}

/** Loads (from the shared cache) a fresh clone of the shoe at `url` for this component instance. */
export function useShoeModel(url: string | null, placeholderSeed = 0): UseShoeModelResult {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const currentInstance = useRef<THREE.Group | null>(null);

  useEffect(() => {
    if (!url) {
      setScene(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);

    loadShoeModel(url, placeholderSeed)
      .then((instance) => {
        if (cancelled) {
          disposeShoeInstance(instance);
          return;
        }
        currentInstance.current = instance;
        setScene(instance);
      })
      .catch(() => {
        if (!cancelled) setError(true);
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
  }, [url, placeholderSeed]);

  return { scene, loading, error };
}
