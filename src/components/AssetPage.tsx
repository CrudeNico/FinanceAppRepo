"use client";

import { useMemo, useState, type PointerEvent } from "react";
import { HistoryCard } from "./HistoryCard";

type RangeKey = "1D" | "1W" | "1M" | "3M" | "1Y" | "MAX";

const ASSET = {
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

type PricePoint = { date: string; value: number };

const RANGES: RangeKey[] = ["1D", "1W", "1M", "3M", "1Y", "MAX"];
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
    points.push({ date: atOffset(spanDays, t), value });
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

function formatChartDate(iso: string) {
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

function euro(value: number, digits = 2) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function AssetPage({ onBack }: { onBack?: () => void }) {
  const [range, setRange] = useState<RangeKey>("1Y");
  const [hover, setHover] = useState<PricePoint | null>(null);
  const prices = useMemo(() => SERIES[range], [range]);
  const shownPrice = hover?.value ?? ASSET.price;

  return (
    <main className="relative mx-auto min-h-full max-w-md bg-white px-5 pb-12 pt-20">
      {onBack ? (
        <div
          className="absolute inset-y-0 left-0 z-20 w-7"
          onPointerDown={(event) => {
            (event.currentTarget as HTMLElement & { __sx?: number }).__sx = event.clientX;
          }}
          onPointerUp={(event) => {
            const start = (event.currentTarget as HTMLElement & { __sx?: number }).__sx ?? 0;
            if (event.clientX - start > 40) onBack();
          }}
        />
      ) : null}
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-[#C8102E] text-[26px] font-bold text-white">
          V
        </div>
        <div className="flex h-11 min-w-0 flex-col justify-center">
          <p className="flex items-center gap-1.5 text-[11px] text-neutral-400">
            {ASSET.ticker} · {ASSET.exchange}
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
          </p>
          <h1 className="text-sm font-bold leading-[18px] text-neutral-950">
            {ASSET.name}
          </h1>
        </div>
      </div>

      <p className="mt-5 text-[52px] font-normal leading-none tracking-tight text-neutral-950">
        <span className="text-[34px]">€</span>
        {shownPrice.toFixed(2)}
      </p>
      <p className="mt-0.5 text-base text-green-600">
        ↗ {ASSET.change.toFixed(2)} ({ASSET.changePct.toFixed(2)}%) last year
      </p>

      <Chart prices={prices} hover={hover} onHover={setHover} />

      <div className="mt-2 flex items-center">
        {RANGES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setHover(null);
              setRange(item);
            }}
            className={`rounded-lg px-2 py-1.5 text-[13px] font-semibold ${
              range === item ? "bg-neutral-200 text-neutral-950" : "text-neutral-400"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <h2 className="mt-8 text-[17px] font-normal text-neutral-950">Your investment</h2>
      <section className="mt-3 rounded-[22px] border border-neutral-200 px-4 py-4">
        <Info label="VALUE" value={euro(ASSET.value)} />
        <Info
          label="RETURN"
          value={`+${euro(ASSET.returnAmount)} (${ASSET.returnPct.toFixed(2)}%)`}
          green
        />
        <Info
          label="SHARES"
          value={new Intl.NumberFormat("de-DE", {
            minimumFractionDigits: 8,
            maximumFractionDigits: 8,
          }).format(ASSET.shares)}
          underline
        />
        <Info label="AVERAGE PRICE" value={euro(ASSET.averagePrice)} last />
      </section>

      <HistoryCard />
    </main>
  );
}

function Info({
  label,
  value,
  green,
  underline,
  last,
}: {
  label: string;
  value: string;
  green?: boolean;
  underline?: boolean;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${last ? "" : "mb-2"}`}>
      <span className="text-xs font-semibold tracking-wide text-neutral-400">{label}</span>
      <span
        className={`text-base font-normal ${green ? "text-green-600" : "text-neutral-950"} ${
          underline ? "underline" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Chart({
  prices,
  hover,
  onHover,
}: {
  prices: PricePoint[];
  hover: PricePoint | null;
  onHover: (point: PricePoint | null) => void;
}) {
  const width = 360;
  const height = 250;
  const left = 0;
  const right = 62;
  const top = 22;
  const bottom = 10;
  const values = prices.map((point) => point.value);
  const min = Math.min(136, ...values) - 2;
  const max = Math.max(168, ...values) + 2;
  const innerW = width - left - right;
  const innerH = height - top - bottom;
  const yFor = (value: number) => top + ((max - value) / (max - min)) * innerH;
  const mapped = prices.map((point, index) => ({
    ...point,
    x: left + (index / Math.max(prices.length - 1, 1)) * innerW,
    y: yFor(point.value),
  }));
  const line = mapped
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const area = `${line} L ${left + innerW} ${top + innerH} L ${left} ${top + innerH} Z`;
  const ticks = [136, 140, 144, 148, 156, 160, 164];
  const hoverPoint = hover
    ? mapped.find((point) => point.date === hover.date) ?? null
    : null;

  function pick(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * width;
    let nearest = 0;
    let best = Infinity;
    mapped.forEach((point, index) => {
      const distance = Math.abs(point.x - x);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    onHover(prices[nearest] ?? null);
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-3 w-full cursor-crosshair"
      onPointerMove={pick}
      onPointerLeave={() => onHover(null)}
    >
      <defs>
        <linearGradient id="assetFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((tick) => (
        <text
          key={tick}
          x={width - 4}
          y={yFor(tick) + 4}
          textAnchor="end"
          className="fill-neutral-400"
          fontSize="10"
        >
          {tick.toFixed(2)}
        </text>
      ))}
      <path d={area} fill="url(#assetFill)" />
      <path
        d={line}
        fill="none"
        stroke="#3B82F6"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <line
        x1={left}
        x2={width - 25}
        y1={yFor(ASSET.price)}
        y2={yFor(ASSET.price)}
        stroke="#3B82F6"
      />
      <line
        x1={left}
        x2={width - 25}
        y1={yFor(ASSET.averagePrice)}
        y2={yFor(ASSET.averagePrice)}
        stroke="#9CA3AF"
        strokeDasharray="4 4"
      />
      <rect x={width - 50} y={yFor(ASSET.price) - 10} width="50" height="20" rx="10" fill="#3B82F6" />
      <text x={width - 25} y={yFor(ASSET.price) + 4} textAnchor="middle" fill="white" fontSize="10" fontWeight="600">
        {ASSET.price.toFixed(2)}
      </text>
      <rect
        x={width - 50}
        y={yFor(ASSET.averagePrice) - 10}
        width="50"
        height="20"
        rx="10"
        fill="#4B5563"
      />
      <text
        x={width - 25}
        y={yFor(ASSET.averagePrice) + 4}
        textAnchor="middle"
        fill="white"
        fontSize="10"
        fontWeight="600"
      >
        {ASSET.averagePrice.toFixed(2)}
      </text>
      {hoverPoint ? (
        <>
          <line
            x1={hoverPoint.x}
            x2={hoverPoint.x}
            y1={16}
            y2={top + innerH}
            stroke="#111111"
          />
          <circle cx={hoverPoint.x} cy={hoverPoint.y} r="4" fill="#3B82F6" />
          <text
            x={Math.min(Math.max(hoverPoint.x, 36), width - 70)}
            y={12}
            textAnchor="middle"
            fill="#111111"
            fontSize="10"
          >
            {formatChartDate(hoverPoint.date)}
          </text>
        </>
      ) : null}
    </svg>
  );
}
