import { shoes } from "../../data/shoes";
import type { ShoeProduct } from "../../types/shoe";

interface ARShoeCarouselProps {
  selectedId: string;
  onSelect: (shoe: ShoeProduct) => void;
}

/**
 * Dark-theme shoe carousel for the AR camera screen and photo-review result
 * screen — thumbnail directly on the dark background with a light ring when
 * selected and a name label underneath, matching the reference design.
 * (The light-card ShoeSelector/ShoeCard remain available for any future
 * light-background product listing; nothing here shares their styling.)
 */
export function ARShoeCarousel({ selectedId, onSelect }: ARShoeCarouselProps) {
  return (
    <div
      role="listbox"
      aria-label="Choose a shoe"
      className="flex w-full gap-3 overflow-x-auto scroll-px-4 px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {shoes.map((shoe) => {
        const isSelected = shoe.id === selectedId;
        return (
          <button
            key={shoe.id}
            type="button"
            role="option"
            aria-selected={isSelected}
            aria-label={`Select ${shoe.name}`}
            onClick={() => onSelect(shoe)}
            className="flex shrink-0 flex-col items-center gap-1"
          >
            <span
              className={[
                "block h-14 w-14 overflow-hidden rounded-xl bg-white/10 ring-2 transition",
                isSelected ? "ring-white" : "ring-transparent",
              ].join(" ")}
            >
              <img
                src={shoe.thumbnail}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </span>
            <span className={["max-w-[64px] truncate text-[10px] font-medium", isSelected ? "text-white" : "text-white/60"].join(" ")}>
              {shoe.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
