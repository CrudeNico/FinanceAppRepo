"use client";

const ASSET = {
  ticker: "VWCE",
  exchange: "XETR",
  name: "Vanguard FTSE All-World (Acc)",
};

export function HomePage({ onOpenStock }: { onOpenStock: () => void }) {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col bg-[#E6E6E6] px-5 pb-9">
      <div className="mt-auto">
        <button
          type="button"
          onClick={onOpenStock}
          className="flex w-full items-center gap-3 rounded-2xl bg-[#F3F3F3] px-3 py-2.5 text-left"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#C8102E] text-xl font-bold text-white">
            V
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] text-neutral-400">
              {ASSET.ticker} · {ASSET.exchange}
            </span>
            <span className="block truncate text-sm font-semibold text-neutral-950">
              {ASSET.name}
            </span>
          </span>
        </button>
      </div>
    </main>
  );
}
