import { shoes } from "../../data/shoes";
import type { ShoeProduct } from "../../types/shoe";
import { ShoeCard } from "../ShoeCard/ShoeCard";

interface ShoeSelectorProps {
  selectedId: string;
  onSelect: (shoe: ShoeProduct) => void;
  compact?: boolean;
}

export function ShoeSelector({ selectedId, onSelect, compact = false }: ShoeSelectorProps) {
  return (
    <div
      role="listbox"
      aria-label="Choose a shoe"
      className="flex w-full gap-2.5 overflow-x-auto scroll-px-4 px-4 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {shoes.map((shoe) => (
        <div key={shoe.id} role="option" aria-selected={shoe.id === selectedId} className={compact ? "" : "w-36 shrink-0"}>
          <ShoeCard shoe={shoe} selected={shoe.id === selectedId} onSelect={onSelect} compact={compact} />
        </div>
      ))}
    </div>
  );
}
