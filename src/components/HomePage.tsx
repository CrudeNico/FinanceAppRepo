"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { loadHistory, type HistoryEntry } from "@/lib/historyStore";

const ASSET = {
  ticker: "VWCE",
  name: "Vanguard FTSE All-World (Acc)",
};

function stockValue(entries: HistoryEntry[]) {
  const ordered = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let shares = 0;
  let last = 0;
  for (const entry of ordered) {
    const amount = Number(entry.amount);
    const price = Number(entry.price);
    if (Number.isFinite(price) && price > 0) last = price;
    if (Number.isFinite(amount) && amount !== 0 && Number.isFinite(price) && price > 0) {
      shares += amount / price;
    }
  }
  return last * shares;
}

export function HomePage({ onOpenStock }: { onOpenStock: () => void }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    loadHistory()
      .then(setEntries)
      .catch(() => setEntries([]));
  }, []);

  const total = useMemo(() => stockValue(entries), [entries]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-[#E6E6E6] px-5 pb-10 pt-[88px]">
      <div className="mb-2.5 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full border border-dashed border-neutral-300 bg-[#EFEFEF]" />
        <h1 className="text-[28px] font-semibold text-neutral-950">Net Worth</h1>
      </div>
      <p className="text-[52px] font-normal leading-none tracking-tight text-neutral-950">
        <span className="text-[34px]">€</span>
        {total.toFixed(2)}
      </p>

      <Section title="Cashflow">
        <div className="flex items-center gap-3 rounded-2xl bg-[#F3F3F3] px-3.5 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#3B82F6] text-sm font-bold text-white">
            C
          </span>
          <span>
            <span className="block text-[11px] text-neutral-400">CASH</span>
            <span className="block text-sm font-semibold text-neutral-950">Cashflow</span>
          </span>
        </div>
      </Section>

      <Section title="Trading" />

      <Section title="Stocks">
        <button
          type="button"
          onClick={onOpenStock}
          className="flex w-full items-center gap-3 rounded-2xl bg-[#F3F3F3] px-3.5 py-3 text-left"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#C8102E] text-xl font-bold text-white">
            V
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] text-neutral-400">{ASSET.ticker}</span>
            <span className="block truncate text-sm font-semibold text-neutral-950">
              {ASSET.name}
            </span>
          </span>
        </button>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section className="mt-7">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[17px] font-normal text-neutral-950">{title}</h2>
      </div>
      {children}
    </section>
  );
}
