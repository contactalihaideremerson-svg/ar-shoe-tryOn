import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getShoeById, shoes } from "../data/shoes";

const TRUST_BADGES = [
  {
    label: "Free Shipping",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 7h11v8H3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M14 10h4l3 3v2h-7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="7" cy="18" r="1.6" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="17.5" cy="18" r="1.6" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    label: "Easy Returns",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 12a8 8 0 1 1 2.5 5.8M4 12v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Secure Payment",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="10" width="16" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 10V7a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function ProductCard() {
  const { shoeId } = useParams();
  const navigate = useNavigate();
  const shoe = useMemo(() => getShoeById(shoeId ?? "") ?? shoes[0], [shoeId]);
  const [added, setAdded] = useState(false);

  const priceLabel = `${shoe.currency === "USD" ? "$" : ""}${shoe.price.toFixed(2)}`;
  // Only one real product photo exists per shoe today — the gallery strip still
  // shows four slots to match the reference layout, all pointing at that same
  // asset, rather than fabricating angles that don't exist.
  const gallery = [shoe.thumbnail, shoe.thumbnail, shoe.thumbnail, shoe.thumbnail];
  const [activeImage, setActiveImage] = useState(0);

  return (
    <div className="flex h-dvh w-full flex-col bg-neutral-950 text-white">
      <div className="flex items-center justify-between px-4 pb-2 pt-4 safe-top">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-sm font-semibold uppercase tracking-wide text-white/80">Product</h1>
        <div className="h-9 w-9" />
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <div className="mb-3 aspect-square w-full overflow-hidden rounded-3xl bg-white/5">
          <img
            src={gallery[activeImage]}
            alt={shoe.name}
            className="h-full w-full object-contain p-8"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>

        <div className="mb-6 flex gap-3">
          {gallery.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveImage(i)}
              aria-label={`View image ${i + 1}`}
              aria-current={activeImage === i}
              className={[
                "h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white/5 ring-2 transition",
                activeImage === i ? "ring-white" : "ring-transparent",
              ].join(" ")}
            >
              <img src={src} alt="" className="h-full w-full object-contain p-2" />
            </button>
          ))}
        </div>

        <div className="mb-1 flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold tracking-tight">{shoe.name}</h2>
          <span className="shrink-0 text-xl font-bold">{priceLabel}</span>
        </div>

        {shoe.rating !== undefined && (
          <div className="mb-4 flex items-center gap-1.5 text-sm text-white/70">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-amber-400" aria-hidden="true">
              <path d="M12 2.5l2.9 6.1 6.6.7-4.9 4.5 1.3 6.6L12 17l-5.9 3.4 1.3-6.6-4.9-4.5 6.6-.7L12 2.5z" />
            </svg>
            <span className="font-medium text-white">{shoe.rating.toFixed(1)}</span>
            <span>({shoe.reviewCount ?? 0})</span>
          </div>
        )}

        <p className="mb-6 text-sm leading-relaxed text-white/60">{shoe.description}</p>

        <div className="mb-6 flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
          {TRUST_BADGES.map((badge) => (
            <div key={badge.label} className="flex flex-1 flex-col items-center gap-1.5 text-center text-white/70">
              {badge.icon}
              <span className="text-[10px] font-medium leading-tight">{badge.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="safe-bottom flex flex-col gap-2.5 px-5 pb-4">
        <button
          type="button"
          onClick={() => navigate(`/try-on/${shoe.id}`)}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 8a2 2 0 0 1 2-2h1.2l.9-1.5A1 1 0 0 1 8.9 4h6.2a1 1 0 0 1 .9.5L16.8 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.7" />
          </svg>
          Try On Live
        </button>
        <button
          type="button"
          onClick={() => setAdded(true)}
          disabled={added}
          className="w-full rounded-full border border-white/25 py-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
        >
          {added ? "Added to Cart ✓" : "Add to Cart"}
        </button>
      </div>
    </div>
  );
}
