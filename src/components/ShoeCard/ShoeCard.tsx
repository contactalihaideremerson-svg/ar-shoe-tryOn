import type { ShoeProduct } from "../../types/shoe";

interface ShoeCardProps {
  shoe: ShoeProduct;
  selected: boolean;
  onSelect: (shoe: ShoeProduct) => void;
  compact?: boolean;
}

export function ShoeCard({ shoe, selected, onSelect, compact = false }: ShoeCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(shoe)}
      aria-pressed={selected}
      aria-label={`Select ${shoe.name}`}
      className={[
        "group relative flex shrink-0 flex-col overflow-hidden rounded-2xl border bg-white text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900",
        compact ? "w-20" : "w-full",
        selected
          ? "border-neutral-900 shadow-[0_0_0_1px_rgba(0,0,0,0.9)]"
          : "border-neutral-200 hover:border-neutral-400",
      ].join(" ")}
    >
      <div className={["relative w-full overflow-hidden bg-neutral-100", compact ? "aspect-square" : "aspect-[4/3]"].join(" ")}>
        <img
          src={shoe.thumbnail}
          alt={shoe.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        {selected && (
          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-white">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </div>
      {!compact && (
        <div className="flex flex-col gap-0.5 px-3 py-2.5">
          <span className="truncate text-sm font-medium text-neutral-900">{shoe.name}</span>
          <span className="text-xs text-neutral-500">${shoe.price.toFixed(0)}</span>
        </div>
      )}
    </button>
  );
}
