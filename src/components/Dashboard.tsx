"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AllocationPie } from "@/components/AllocationPie";
import { FadeChart } from "@/components/FadeChart";
import {
  DEMO_INVESTMENTS,
  DEMO_NET_WORTH,
  PRICE_SERIES,
  allocation,
  filterSeries,
  formatDate,
  formatEuro,
  newId,
  netWorthSeries,
  priceInEur,
  type Fund,
  type FundId,
  type Investment,
  type Range,
} from "@/lib/portfolio";

const RANGES: Range[] = ["1M", "3M", "6M", "1Y", "All"];
const STORAGE_KEY = "finance-app-investments";
const FUNDS_KEY = "finance-app-extra-funds";

function NetWorthFigure({ value }: { value: number }) {
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  const [whole, decimals = "00"] = formatted.split(",");

  return (
    <p className="mt-3 font-serif text-5xl tracking-tight text-white sm:text-6xl">
      {whole}
      <span className="align-top text-[0.42em] opacity-75">,{decimals}</span>
      <span className="ml-1 align-top text-[0.38em] opacity-75">€</span>
    </p>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      data-slot="icon"
      fill="none"
      strokeWidth="1.5"
      stroke="currentColor"
      viewBox="0 0 24 24"
      className="h-5 w-5 text-ink"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={open ? "m4.5 15.75 7.5-7.5 7.5 7.5" : "m19.5 8.25-7.5 7.5-7.5-7.5"}
      />
    </svg>
  );
}

export function Dashboard() {
  const [investments, setInvestments] = useState<Investment[]>(DEMO_INVESTMENTS);
  const [extraFunds, setExtraFunds] = useState<Fund[]>([]);
  const [range, setRange] = useState<Range>("All");
  const [selectedFund, setSelectedFund] = useState<FundId | null>(null);
  const [adding, setAdding] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [draftDate, setDraftDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [draftAmount, setDraftAmount] = useState("");
  const [draftEntry, setDraftEntry] = useState("");
  const [draftEuros, setDraftEuros] = useState("");
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  function writeInvestments(next: Investment[]) {
    setInvestments(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function writeExtraFunds(next: Fund[]) {
    setExtraFunds(next);
    window.localStorage.setItem(FUNDS_KEY, JSON.stringify(next));
  }

  useEffect(() => {
    const storedInvestments = window.localStorage.getItem(STORAGE_KEY);
    const storedFunds = window.localStorage.getItem(FUNDS_KEY);
    if (storedInvestments) {
      try {
        setInvestments(JSON.parse(storedInvestments) as Investment[]);
      } catch {
        /* keep demo */
      }
    }
    if (storedFunds) {
      try {
        setExtraFunds(JSON.parse(storedFunds) as Fund[]);
      } catch {
        /* keep empty */
      }
    }
  }, []);

  const slices = useMemo(
    () =>
      allocation(investments, extraFunds)
        .filter((item) => item.value > 0)
        .map((item) => ({
          id: item.fund.id,
          name: item.fund.name,
          value: item.value,
          color: item.fund.color,
        })),
    [extraFunds, investments],
  );

  const history = useMemo(() => {
    const rows = selectedFund
      ? investments.filter((item) => item.fundId === selectedFund)
      : investments;
    return [...rows].sort((a, b) => b.date.localeCompare(a.date));
  }, [investments, selectedFund]);

  const overlay = Boolean(selectedFund);

  const chartData = useMemo(() => {
    if (overlay && selectedFund) {
      const known = PRICE_SERIES[selectedFund] ?? [];
      const extra = investments
        .filter((item) => item.fundId === selectedFund)
        .map((item) => ({ date: item.date, value: priceInEur(item) }));
      const merged = new Map(known.map((point) => [point.date, point.value]));
      for (const point of extra) {
        if (!merged.has(point.date)) merged.set(point.date, point.value);
      }
      const series = [...merged.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({ date, value }));
      return filterSeries(series.length > 1 ? series : extra, range);
    }
    return filterSeries(netWorthSeries(investments), range);
  }, [investments, overlay, range, selectedFund]);

  const clearFund = useCallback(() => {
    setHoverValue(null);
    setSelectedFund(null);
  }, []);

  function toggleFund(id: FundId) {
    setHoverValue(null);
    setSelectedFund((current) => (current === id ? null : id));
  }

  function acceptDraft() {
    const amountEur = Number(draftAmount.replace(",", "."));
    const sharePrice = Number(draftEntry.replace(",", "."));
    const euros = Number(draftEuros.replace(",", "."));
    if (!draftDate || !amountEur || !sharePrice) return;

    const currency = euros && Math.abs(euros - sharePrice) > 0.01 ? "USD" : "EUR";
    const fxRate = currency === "USD" ? euros / sharePrice : 1;

    writeInvestments([
      ...investments,
      {
        id: newId(),
        fundId: selectedFund ?? "nasdaq",
        date: draftDate,
        amountEur,
        sharePrice,
        currency,
        fxRate,
      },
    ]);
    setDraftAmount("");
    setDraftEntry("");
    setDraftEuros("");
    setAdding(false);
    setHistoryOpen(true);
  }

  const latestAmount = chartData[chartData.length - 1]?.value ?? DEMO_NET_WORTH;
  const shownNet = hoverValue ?? latestAmount;

  return (
    <main className="page-in min-h-full bg-white">
      <div className="hero-fade px-5 pb-10 pt-8 sm:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">
            Total net worth
          </p>
          <NetWorthFigure value={shownNet} />

          <section className="mt-8" data-keep-fund>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {RANGES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setHoverValue(null);
                      setRange(item);
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs transition ${
                      range === item
                        ? "bg-white text-navy"
                        : "text-white/55 hover:text-white"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <FadeChart
              data={chartData}
              chartKey={`${overlay ? "fund" : "net"}-${range}-${selectedFund ?? "all"}`}
              onHoverValue={setHoverValue}
            />
          </section>
        </div>
      </div>

      <section className="sheet-cut relative -mt-6 px-5 pb-16 pt-8 sm:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <AllocationPie
            slices={slices}
            selected={selectedFund}
            onSelect={toggleFund}
            onClear={clearFund}
            onAdd={({ name, color, amountEur }) => {
              const id = `fund-${Date.now()}`;
              writeExtraFunds([
                ...extraFunds,
                { id, name, label: name, color },
              ]);
              writeInvestments([
                ...investments,
                {
                  id: newId(),
                  fundId: id,
                  date: new Date().toISOString().slice(0, 10),
                  amountEur,
                  sharePrice: 1,
                  currency: "EUR",
                  fxRate: 1,
                },
              ]);
            }}
          />

          <div className="mt-10" data-keep-fund>
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl text-ink">History</h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setHistoryOpen((open) => !open)}
                  className="grid h-8 w-8 place-items-center rounded-full hover:bg-ink/5"
                  aria-expanded={historyOpen}
                  aria-label={historyOpen ? "Hide history" : "Show history"}
                >
                  <Chevron open={historyOpen} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(true);
                    setHistoryOpen(true);
                  }}
                  className="grid h-8 w-8 place-items-center rounded-full text-ink hover:bg-ink/5"
                  aria-label="Add entry"
                >
                  <svg
                    data-slot="icon"
                    fill="none"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4.5v15m7.5-7.5h-15"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {historyOpen ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[36rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-ink/15 text-left text-[11px] uppercase tracking-wide text-muted">
                      <th className="py-2 pr-4 font-medium">Date</th>
                      <th className="py-2 pr-4 font-medium">Amount</th>
                      <th className="py-2 pr-4 font-medium">Entry price</th>
                      <th className="py-2 pr-4 font-medium">In euros</th>
                      <th className="py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {adding ? (
                      <tr>
                        <td className="py-3 pr-4">
                          <input
                            type="date"
                            value={draftDate}
                            onChange={(event) => setDraftDate(event.target.value)}
                            className="w-full border-b border-ink/20 bg-transparent py-1 text-ink outline-none"
                          />
                        </td>
                        <td className="py-3 pr-4">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
                            value={draftAmount}
                            onChange={(event) => setDraftAmount(event.target.value)}
                            className="w-full border-b border-ink/20 bg-transparent py-1 font-mono text-ink outline-none"
                          />
                        </td>
                        <td className="py-3 pr-4">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Price"
                            value={draftEntry}
                            onChange={(event) => setDraftEntry(event.target.value)}
                            className="w-full border-b border-ink/20 bg-transparent py-1 text-ink outline-none"
                          />
                        </td>
                        <td className="py-3 pr-4">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="If USD"
                            value={draftEuros}
                            onChange={(event) => setDraftEuros(event.target.value)}
                            className="w-full border-b border-ink/20 bg-transparent py-1 text-ink outline-none"
                          />
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={acceptDraft}
                            className="rounded-full bg-navy px-3 py-1 text-xs text-white"
                          >
                            ✓
                          </button>
                        </td>
                      </tr>
                    ) : (
                      history.map((item) => (
                        <tr key={item.id} className="border-b border-ink/8">
                          <td className="py-3 pr-4 text-ink">{formatDate(item.date)}</td>
                          <td className="py-3 pr-4 font-mono text-ink">
                            {formatEuro(item.amountEur)}
                          </td>
                          <td className="py-3 pr-4 text-ink">
                            {item.currency === "USD"
                              ? new Intl.NumberFormat("en-US", {
                                  style: "currency",
                                  currency: "USD",
                                }).format(item.sharePrice)
                              : formatEuro(item.sharePrice)}
                          </td>
                          <td className="py-3 pr-4 text-ink">
                            {item.currency === "USD"
                              ? `${formatEuro(priceInEur(item))} · FX ${item.fxRate.toFixed(4)}`
                              : "—"}
                          </td>
                          <td />
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
