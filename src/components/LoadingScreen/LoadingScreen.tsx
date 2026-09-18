interface LoadingScreenProps {
  message?: string;
  progress?: number; // 0..100, optional
}

export function LoadingScreen({ message = "Loading…", progress }: LoadingScreenProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-neutral-950 px-6 text-center" role="status" aria-live="polite">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-neutral-700 border-t-white" />
      </div>
      <p className="text-sm font-medium text-neutral-300">{message}</p>
      {typeof progress === "number" && (
        <div className="h-1 w-40 overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full rounded-full bg-white transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
