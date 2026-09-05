"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { formatDate, type SeriesPoint } from "@/lib/portfolio";

type HoverMark = {
  value: number;
  label: string;
  x: number;
};

type Props = {
  data: SeriesPoint[];
  chartKey: string;
  onHoverValue: (value: number | null) => void;
};

export function FadeChart({ data, chartKey, onHoverValue }: Props) {
  const [hover, setHover] = useState<HoverMark | null>(null);
  const gradientId = `shade-${chartKey.replace(/[^a-zA-Z0-9]/g, "")}`;
  const formatted = data.map((point) => ({
    ...point,
    label: formatDate(point.date),
  }));
  const startLabel = formatted[0]?.label;
  const endLabel = formatted[formatted.length - 1]?.label;

  function clearHover() {
    setHover(null);
    onHoverValue(null);
  }

  return (
    <div
      key={chartKey}
      className="chart-fade relative h-80 w-full touch-none"
      onMouseLeave={clearHover}
      onTouchEnd={clearHover}
      onTouchCancel={clearHover}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={formatted}
          margin={{ top: 10, right: 20, left: 20, bottom: 8 }}
          onMouseMove={(state) => {
            const event = state as {
              activePayload?: { value: number }[];
              activeLabel?: string;
              activeCoordinate?: { x: number };
            };
            const value = event.activePayload?.[0]?.value;
            const label = event.activeLabel;
            const x = event.activeCoordinate?.x;
            if (typeof value === "number" && label && typeof x === "number") {
              setHover({ value, label, x });
              onHoverValue(value);
            }
          }}
          onMouseLeave={clearHover}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.22} />
              <stop offset="70%" stopColor="#ffffff" stopOpacity={0.04} />
              <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#ffffff" strokeOpacity={0.08} />
          <Tooltip cursor={{ stroke: "rgba(255,255,255,0.35)", strokeWidth: 1 }} content={() => null} />
          <Area
            type="natural"
            dataKey="value"
            stroke="rgba(255,255,255,0.88)"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            animationDuration={800}
            animationEasing="ease-out"
            dot={false}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="chart-end-fade pointer-events-none absolute inset-x-0 top-0 bottom-7" />
      {hover ? (
        <div
          className="pointer-events-none absolute bottom-1 whitespace-nowrap text-[11px] text-white/70"
          style={{
            left: `clamp(12px, ${hover.x}px, calc(100% - 12px))`,
            transform: "translateX(-50%)",
          }}
        >
          {hover.label}
        </div>
      ) : (
        <>
          <p className="pointer-events-none absolute bottom-1 left-3 text-[11px] text-white/70">
            {startLabel}
          </p>
          <p className="pointer-events-none absolute bottom-1 right-3 text-right text-[11px] text-white/70">
            {endLabel}
          </p>
        </>
      )}
    </div>
  );
}
