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

export function toAmount(value: string) {
  const parsed = Number(value.trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

const RANGE_DAYS: Record<RangeKey, number | null> = {
  "1D": 1,
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "1Y": 365,
  MAX: null,
};

export function filterByRange<T extends { date: string }>(items: T[], range: RangeKey) {
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0 || range === "MAX") return sorted;
  const days = RANGE_DAYS[range];
  if (days == null) return sorted;
  const end = new Date(`${sorted[sorted.length - 1].date.slice(0, 10)}T00:00:00`);
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const filtered = sorted.filter((item) => new Date(`${item.date.slice(0, 10)}T00:00:00`) >= start);
  return filtered.length > 0 ? filtered : sorted.slice(-1);
}

export function filterSeries(points: PricePoint[], range: RangeKey) {
  return filterByRange(points, range);
}

export function seriesChange(points: PricePoint[]) {
  if (points.length === 0) return { amount: 0, pct: 0 };
  const start = points[0].value;
  const end = points[points.length - 1].value;
  const amount = end - start;
  const pct = start === 0 ? 0 : (amount / start) * 100;
  return { amount, pct };
}

export function chartScale(values: number[]) {
  if (values.length === 0) return { min: 0, max: 1, ticks: [0, 1] };
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = Math.max(high - low, Math.abs(high) * 0.04, 1);
  const min = low - span * 0.12;
  const max = high + span * 0.12;
  const step = (max - min) / 4;
  const ticks = [0, 1, 2, 3, 4].map((index) => min + step * index);
  return { min, max, ticks };
}

export function stockStats(entries: HistoryEntry[]) {
  const ordered = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let value = 0;
  let lastPrice = 0;
  let priceSum = 0;
  let priceCount = 0;
  const prices: PricePoint[] = [];
  const amounts: PricePoint[] = [];
  ordered.forEach((entry) => {
    if (entry.amount.trim() !== "") {
      value += toAmount(entry.amount);
      amounts.push({ date: entry.date, value });
    }
    if (entry.price.trim() !== "") {
      const price = toAmount(entry.price);
      lastPrice = price;
      priceSum += price;
      priceCount += 1;
      prices.push({ date: entry.date, value: price });
    }
  });
  const averagePrice = priceCount === 0 ? 0 : priceSum / priceCount;
  return { value, lastPrice, averagePrice, prices, amounts };
}

export function stockValuePoints(entries: HistoryEntry[]) {
  return stockStats(entries).amounts;
}

export type AssetKind = "start" | "inc" | "dec";

export type AssetEntry = {
  id: string;
  date: string;
  amount: string;
  kind: AssetKind;
};

function orderAssetEntries(entries: AssetEntry[]) {
  return [...entries].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    if (a.kind === "start") return -1;
    if (b.kind === "start") return 1;
    return a.id.localeCompare(b.id);
  });
}

export function assetStats(entries: AssetEntry[]) {
  const history: PricePoint[] = [];
  let value = 0;
  orderAssetEntries(entries).forEach((entry) => {
    if (entry.amount.trim() === "") return;
    const amount = toAmount(entry.amount);
    if (entry.kind === "start") value = amount;
    else if (entry.kind === "dec") value -= Math.abs(amount);
    else value += Math.abs(amount);
    history.push({ date: entry.date, value });
  });
  const prices =
    history.length === 0 ? [] : [{ date: history[0].date, value: 0 }, ...history];
  return { value, prices, history };
}

export function assetValuePoints(entries: AssetEntry[]) {
  return assetStats(entries).history;
}

export function mergeValueSeries(seriesList: PricePoint[][]) {
  const dates = new Set<string>();
  seriesList.forEach((series) => series.forEach((point) => dates.add(point.date)));
  const sorted = [...dates].sort((a, b) => a.localeCompare(b));
  const queues = seriesList.map((series) =>
    [...series].sort((a, b) => a.date.localeCompare(b.date)),
  );
  const last = seriesList.map(() => 0);
  const index = seriesList.map(() => 0);
  return sorted.map((date) => {
    queues.forEach((series, i) => {
      while (index[i] < series.length && series[index[i]].date <= date) {
        last[i] = series[index[i]].value;
        index[i] += 1;
      }
    });
    return { date, value: last.reduce((sum, item) => sum + item, 0) };
  });
}

export function tradingStats(entries: import("./models").TradeRow[]) {
  const chronological = [...entries].sort((a, b) => {
    const byMonth = a.month.localeCompare(b.month);
    if (byMonth !== 0) return byMonth;
    if (a.id === "t-start") return -1;
    if (b.id === "t-start") return 1;
    return a.id.localeCompare(b.id);
  });
  let running = 0;
  let profit = 0;
  const prices: PricePoint[] = [];
  chronological.forEach((entry) => {
    const pnl = toAmount(entry.gain) - toAmount(entry.loss);
    const flow = toAmount(entry.deposit) - toAmount(entry.withdrawal);
    profit += pnl;
    running += pnl + flow;
    prices.push({ date: `${entry.month}-01`, value: running });
  });
  const invested = running - profit;
  const returnPct = invested === 0 ? 0 : (profit / Math.abs(invested)) * 100;
  return { value: running, returnAmount: profit, returnPct, prices };
}

function isStartingBalance(entry: import("./models").CashflowEntry) {
  return entry.id === "c-start" || entry.label === "Starting balance";
}

export function cashflowStats(entries: import("./models").CashflowEntry[]) {
  const start = entries.find(isStartingBalance);
  const rest = entries
    .filter((entry) => !isStartingBalance(entry) && entry.amount.trim() !== "")
    .sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
    });

  let running = start ? toAmount(start.amount) : 0;
  let expenses = 0;
  const expenseMonths = new Set<string>();
  const prices: PricePoint[] = [];
  if (start && start.amount.trim() !== "") {
    prices.push({ date: start.date, value: running });
  }
  rest.forEach((entry) => {
    const amount = toAmount(entry.amount);
    if (entry.kind === "expense") {
      expenses += amount;
      expenseMonths.add(entry.date.slice(0, 7));
      running -= amount;
    } else {
      running += amount;
    }
    prices.push({ date: entry.date, value: running });
  });
  const monthCount = Math.max(expenseMonths.size, 1);
  const monthlyExpenses = expenses / monthCount;
  return { value: running, expenses, monthlyExpenses, prices };
}

export function todayIso() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
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

export function formatCompact(value: number) {
  const n = Number.isFinite(value) ? value : 0;
  if (Math.abs(n) >= 1000) return String(Math.round(n));
  return n.toFixed(2);
}

export function formatEuro(value: number, digits?: number) {
  const frac = digits ?? (Math.abs(value) >= 1000 ? 0 : 2);
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
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
