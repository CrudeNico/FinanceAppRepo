export type RangeKey = "1D" | "1W" | "1M" | "3M" | "1Y" | "MAX";

export type PricePoint = {
  date: string;
  value: number;
};

export const ASSET = {
  ticker: "VWCE",
  exchange: "XETR",
  name: "Vanguard FTSE All-World (Acc)",
  price: 167.88,
  change: 32.4,
  changePct: 23.91,
  value: 4762.8,
  returnAmount: 432.8,
  returnPct: 10,
  shares: 28.37028698,
  averagePrice: 152.62,
};

const END = new Date("2026-09-05T00:00:00");

function atOffset(spanDays: number, t: number) {
  const next = new Date(END.getTime() + (t - 1) * spanDays * 24 * 60 * 60 * 1000);
  if (spanDays <= 1) return next.toISOString();
  return next.toISOString().slice(0, 10);
}

function walk(count: number, start: number, end: number, seed: number, spanDays: number) {
  const points: PricePoint[] = [];
  let value = start;
  for (let i = 0; i < count; i += 1) {
    const t = i / Math.max(count - 1, 1);
    const target = start + (end - start) * t;
    const wobble =
      Math.sin(i * 0.72 + seed) * 2.6 +
      Math.sin(i * 1.4 + seed * 2) * 1.4;
    value = i === count - 1 ? end : Number((value * 0.4 + target * 0.6 + wobble).toFixed(2));
    points.push({
      date: atOffset(spanDays, t),
      value,
    });
  }
  return points;
}

const SERIES: Record<RangeKey, PricePoint[]> = {
  "1D": walk(28, 166.4, 167.88, 1.2, 1),
  "1W": walk(26, 164.9, 167.88, 2.1, 7),
  "1M": walk(32, 161.2, 167.88, 0.8, 30),
  "3M": walk(36, 154.6, 167.88, 3.4, 90),
  "1Y": walk(48, 135.5, 167.88, 1.7, 365),
  MAX: walk(52, 118.4, 167.88, 4.2, 900),
};

export function seriesFor(range: RangeKey) {
  return SERIES[range];
}

export function rangeChange(range: RangeKey) {
  const series = SERIES[range];
  const start = series[0].value;
  const end = series[series.length - 1].value;
  const amount = end - start;
  const pct = start === 0 ? 0 : (amount / start) * 100;
  return { amount, pct };
}

export function rangePeriodLabel(range: RangeKey) {
  switch (range) {
    case "1D":
      return "last day";
    case "1W":
      return "last week";
    case "1M":
      return "last month";
    case "3M":
      return "last 3 months";
    case "1Y":
      return "last year";
    case "MAX":
      return "all time";
  }
}

export function formatEuro(value: number, digits = 2) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export type HistoryEntry = {
  id: string;
  date: string;
  amount: string;
  price: string;
  fx: string;
};

export const TODAY = "2026-09-05";

export const INITIAL_HISTORY: HistoryEntry[] = [
  { id: "h1", date: "2026-03-12", amount: "1200", price: "152.10", fx: "" },
  { id: "h2", date: "2026-01-08", amount: "800", price: "148.40", fx: "" },
  { id: "h3", date: "2025-11-20", amount: "1500", price: "141.20", fx: "1.08" },
];

export function formatDayMonth(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  return `${date.getDate()} ${date.toLocaleDateString("en-GB", { month: "short" })}`;
}

export function yearOf(iso: string) {
  return Number(iso.slice(0, 4));
}

export function formatChartDate(iso: string) {
  const date = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`);
  if (iso.includes("T")) {
    return date.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
