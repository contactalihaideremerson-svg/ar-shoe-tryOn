import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";

interface HeaderProps {
  title: string;
  showBack?: boolean;
  right?: ReactNode;
}

export function Header({ title, showBack = false, right }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-neutral-200/70 bg-white/80 px-4 py-3 backdrop-blur-md safe-top">
      <div className="flex min-w-0 items-center gap-3">
        {showBack && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-700 transition hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <h1 className="truncate text-[15px] font-semibold tracking-tight text-neutral-900">{title}</h1>
      </div>
      {right && <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">{right}</div>}
    </header>
  );
}
