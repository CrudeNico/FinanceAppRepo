export type FundId = string;
export type Currency = "EUR" | "USD";
export type Range = "1M" | "3M" | "6M" | "1Y" | "All";
export type ChartMode = "networth" | "purchases";

export type Fund = {
  id: FundId;
  name: string;
  label: string;
  color: string;
};

export type Investment = {
  id: string;
  fundId: FundId;
  date: string;
  amountEur: number;
  sharePrice: number;
  currency: Currency;
  fxRate: number;
};

export type SeriesPoint = {
  date: string;
  value: number;
};

export const BROKERS = ["Interactive Brokers", "Trade Republic"] as const;

export const FUNDS: Fund[] = [
  { id: "nasdaq", name: "Nasdaq", label: "Nasdaq-100", color: "#0B1F3A" },
  { id: "vanguard", name: "S&P 500", label: "S&P 500", color: "#3D7AB5" },
];

export const SLICE_PALETTE = [
  "#0B1F3A",
  "#163864",
  "#3D7AB5",
  "#6B9BC4",
  "#5B7C6E",
  "#8B5E3C",
  "#C4A574",
  "#B85C38",
  "#7A6B8A",
  "#4A7C59",
] as const;

export const DEMO_NET_WORTH = 20_000;

export const DEMO_INVESTMENTS: Investment[] = [
  {
    id: "v1",
    fundId: "vanguard",
    date: "2024-01-20",
    amountEur: 3000,
    sharePrice: 88.4,
    currency: "EUR",
    fxRate: 1,
  },
  {
    id: "n1",
    fundId: "nasdaq",
    date: "2024-03-12",
    amountEur: 2500,
    sharePrice: 812,
    currency: "EUR",
    fxRate: 1,
  },
  {
    id: "v2",
    fundId: "vanguard",
    date: "2024-07-11",
    amountEur: 2500,
    sharePrice: 94.1,
    currency: "EUR",
    fxRate: 1,
  },
  {
    id: "n2",
    fundId: "nasdaq",
    date: "2024-09-04",
    amountEur: 1800,
    sharePrice: 940,
    currency: "USD",
    fxRate: 0.92,
  },
  {
    id: "n3",
    fundId: "nasdaq",
    date: "2025-02-18",
    amountEur: 2200,
    sharePrice: 910,
    currency: "EUR",
    fxRate: 1,
  },
  {
    id: "v3",
    fundId: "vanguard",
    date: "2025-04-03",
    amountEur: 2800,
    sharePrice: 99.6,
    currency: "EUR",
    fxRate: 1,
  },
  {
    id: "v4",
    fundId: "vanguard",
    date: "2025-11-19",
    amountEur: 1700,
    sharePrice: 104.2,
    currency: "EUR",
    fxRate: 1,
  },
  {
    id: "n4",
    fundId: "nasdaq",
    date: "2026-01-08",
    amountEur: 1500,
    sharePrice: 1040,
    currency: "USD",
    fxRate: 0.91,
  },
];

const NASDAQ_PRICES: SeriesPoint[] = [
  { date: "2024-01-01", value: 788 },
  { date: "2024-03-01", value: 805 },
  { date: "2024-03-12", value: 812 },
  { date: "2024-06-01", value: 848 },
  { date: "2024-09-01", value: 860 },
  { date: "2024-09-04", value: 865 },
  { date: "2024-12-01", value: 882 },
  { date: "2025-02-18", value: 910 },
  { date: "2025-06-01", value: 928 },
  { date: "2025-09-01", value: 941 },
  { date: "2026-01-08", value: 946 },
  { date: "2026-04-01", value: 968 },
  { date: "2026-09-01", value: 982 },
];

const VANGUARD_PRICES: SeriesPoint[] = [
  { date: "2024-01-01", value: 86.2 },
  { date: "2024-01-20", value: 88.4 },
  { date: "2024-04-01", value: 90.1 },
  { date: "2024-07-11", value: 94.1 },
  { date: "2024-10-01", value: 96.4 },
  { date: "2025-01-01", value: 97.8 },
  { date: "2025-04-03", value: 99.6 },
  { date: "2025-08-01", value: 102.1 },
  { date: "2025-11-19", value: 104.2 },
  { date: "2026-03-01", value: 107.4 },
  { date: "2026-09-01", value: 110.8 },
];

export const PRICE_SERIES: Record<string, SeriesPoint[]> = {
  nasdaq: NASDAQ_PRICES,
  vanguard: VANGUARD_PRICES,
};

export function fundById(id: FundId, extras: Fund[] = []) {
  return FUNDS.find((fund) => fund.id === id) ?? extras.find((fund) => fund.id === id);
}

export function priceInEur(investment: Investment) {
  return investment.currency === "EUR"
    ? investment.sharePrice
    : investment.sharePrice * investment.fxRate;
}

export function formatCompactAxis(value: number) {
  if (Math.abs(value) >= 1000) {
    const thousands = value / 1000;
    const text =
      Math.abs(thousands - Math.round(thousands)) < 0.05
        ? String(Math.round(thousands))
        : thousands.toFixed(1).replace(".", ",");
    return `${text}k`;
  }
  return String(Math.round(value));
}

export function formatEuro(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPrice(investment: Investment) {
  if (investment.currency === "EUR") {
    return formatEuro(investment.sharePrice);
  }
  const dollars = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(investment.sharePrice);
  return `${dollars} · ${formatEuro(priceInEur(investment))}`;
}

export function formatDate(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  const day = date.getDate();
  const month = date.toLocaleDateString("en-GB", { month: "short" });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

export function latestPrice(fundId: FundId) {
  const series = PRICE_SERIES[fundId];
  return series?.[series.length - 1]?.value ?? 1;
}

export function sharesBought(investment: Investment) {
  return investment.amountEur / priceInEur(investment);
}

export function currentValue(investments: Investment[]) {
  return investments.reduce((sum, item) => {
    return sum + sharesBought(item) * latestPrice(item.fundId);
  }, 0);
}

export function allocation(investments: Investment[], extras: Fund[] = []) {
  return [...FUNDS, ...extras].map((fund) => {
    const items = investments.filter((item) => item.fundId === fund.id);
    return {
      fund,
      invested: items.reduce((sum, item) => sum + item.amountEur, 0),
      value: currentValue(items),
    };
  });
}

export function filterSeries(series: SeriesPoint[], range: Range) {
  if (range === "All") return series;
  const last = new Date(`${series[series.length - 1].date}T00:00:00`);
  const start = new Date(last);
  if (range === "1M") start.setMonth(start.getMonth() - 1);
  if (range === "3M") start.setMonth(start.getMonth() - 3);
  if (range === "6M") start.setMonth(start.getMonth() - 6);
  if (range === "1Y") start.setFullYear(start.getFullYear() - 1);
  const filtered = series.filter((point) => new Date(`${point.date}T00:00:00`) >= start);
  return filtered.length > 1 ? filtered : series.slice(-2);
}

export function netWorthSeries(investments: Investment[]): SeriesPoint[] {
  const months: SeriesPoint[] = [
    { date: "2024-01-01", value: 11200 },
    { date: "2024-03-01", value: 12480 },
    { date: "2024-05-01", value: 13120 },
    { date: "2024-07-01", value: 14260 },
    { date: "2024-09-01", value: 15140 },
    { date: "2024-11-01", value: 15790 },
    { date: "2025-01-01", value: 16340 },
    { date: "2025-03-01", value: 16980 },
    { date: "2025-06-01", value: 17620 },
    { date: "2025-09-01", value: 18210 },
    { date: "2025-12-01", value: 18840 },
    { date: "2026-03-01", value: 19360 },
    { date: "2026-06-01", value: 19720 },
    { date: "2026-09-01", value: DEMO_NET_WORTH },
  ];
  const live = currentValue(investments);
  if (Math.abs(live - DEMO_NET_WORTH) > 1) {
    months[months.length - 1] = { date: "2026-09-01", value: Math.round(live) };
  }
  return months;
}

export function newId() {
  return `inv-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}
