import { useNavigate } from "react-router-dom";
import { shoes } from "../data/shoes";

const STEPS = [
  {
    title: "Open Camera",
    description: "Grant camera access — everything runs privately on your device.",
  },
  {
    title: "Choose Your Shoe",
    description: "Pick from six styles and switch between them instantly.",
  },
  {
    title: "See It On Your Feet",
    description: "Watch the 3D shoe track your feet in real time, or try it on a photo.",
  },
];

export function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-full bg-white">
      <header className="sticky top-0 z-40 border-b border-neutral-200/70 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <span className="text-[15px] font-bold tracking-tight">VIRTUAL FIT</span>
          <button
            type="button"
            onClick={() => navigate("/try-on")}
            className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
          >
            Start Try-On
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-5 pb-14 pt-14 text-center sm:pt-20">
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
          Real-time WebAR
        </span>
        <h1 className="max-w-2xl text-4xl font-bold leading-[1.08] tracking-tight text-neutral-950 sm:text-6xl">
          Try Shoes Before You Buy
        </h1>
        <p className="max-w-lg text-base leading-relaxed text-neutral-500 sm:text-lg">
          See how your favorite styles look on your feet in real time, right in your browser — no app required.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => navigate("/try-on")}
            className="rounded-full bg-neutral-900 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            Start Virtual Try-On
          </button>
          <a
            href="#shoes"
            className="rounded-full border border-neutral-300 px-7 py-3.5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            Browse Shoes
          </a>
        </div>
      </section>

      {/* Shoe grid */}
      <section id="shoes" className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-950">Our Collection</h2>
          <span className="text-sm text-neutral-400">{shoes.length} styles</span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {shoes.map((shoe) => (
            <button
              key={shoe.id}
              type="button"
              onClick={() => navigate(`/product/${shoe.id}`)}
              className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left transition hover:border-neutral-400 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            >
              <div className="aspect-square w-full overflow-hidden bg-neutral-100">
                <img
                  src={shoe.thumbnail}
                  alt={shoe.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
              <div className="flex flex-col gap-0.5 px-3 py-2.5">
                <span className="truncate text-sm font-medium text-neutral-900">{shoe.name}</span>
                <span className="text-xs text-neutral-500">${shoe.price.toFixed(0)}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-neutral-100 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="mb-10 text-center text-xl font-semibold tracking-tight text-neutral-950">How It Works</h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step.title} className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <h3 className="text-sm font-semibold text-neutral-900">{step.title}</h3>
                <p className="max-w-xs text-sm leading-relaxed text-neutral-500">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-100 px-5 py-8 text-center text-xs text-neutral-400">
        <p>Your camera is used only for the virtual try-on experience and is processed entirely on your device.</p>
        <p className="mt-2">
          Placeholder 3D models from{" "}
          <a href="https://poly.pizza" target="_blank" rel="noreferrer" className="underline hover:text-neutral-600">
            Poly Pizza
          </a>{" "}
          — "Sneakers", "Pair of shoes" &amp; "Cowboy boots" by Poly by Google, "Trainer" by jeremy (CC-BY); "Boots" &amp;
          "Slippers" by Isa Lousberg (CC0). See CREDITS.md.
        </p>
      </footer>
    </div>
  );
}
