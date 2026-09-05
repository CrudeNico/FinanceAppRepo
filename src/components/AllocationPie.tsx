"use client";

import { useEffect, useRef, useState } from "react";
import { formatEuro, SLICE_PALETTE, type FundId } from "@/lib/portfolio";

type Slice = {
  id: FundId;
  name: string;
  value: number;
  color: string;
};

type Props = {
  slices: Slice[];
  selected: FundId | null;
  onSelect: (id: FundId) => void;
  onClear: () => void;
  onAdd: (draft: { name: string; color: string; amountEur: number }) => void;
};

export function AllocationPie({ slices, selected, onSelect, onClear, onAdd }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [adding, setAdding] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftAmount, setDraftAmount] = useState("");
  const [draftColor, setDraftColor] = useState<string>(SLICE_PALETTE[2]);
  const draftRef = useRef({ name: "", amount: "", color: SLICE_PALETTE[2] as string });
  const onAddRef = useRef(onAdd);
  draftRef.current = { name: draftName, amount: draftAmount, color: draftColor };
  onAddRef.current = onAdd;

  const visible = adding
    ? []
    : selected
      ? slices.filter((slice) => slice.id === selected)
      : slices;
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
  const size = 168;
  const radius = 58;
  const inner = 34;
  const cx = size / 2;
  const cy = size / 2;

  function parsedDraft(source = draftRef.current) {
    const amountEur = Number(source.amount.replace(",", "."));
    const name = source.name.trim();
    if (!name || !amountEur) return null;
    return { name, color: source.color, amountEur };
  }

  function closeAdd(save = false) {
    if (save) {
      const draft = parsedDraft();
      if (draft) onAddRef.current(draft);
    }
    setAdding(false);
    setPaletteOpen(false);
    setDraftName("");
    setDraftAmount("");
  }

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (rootRef.current?.contains(target)) return;
      if (target?.closest("[data-keep-fund]")) return;
      closeAdd(true);
      onClear();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onClear]);

  const arcs = slices.map((slice, index) => {
    const start = slices.slice(0, index).reduce((sum, item) => {
      return sum + (item.value / total) * Math.PI * 2;
    }, -Math.PI / 2);
    const sweep = (slice.value / total) * Math.PI * 2;
    const end = start + sweep;
    const large = sweep > Math.PI ? 1 : 0;
    const outerStart = polar(cx, cy, radius, start);
    const outerEnd = polar(cx, cy, radius, end);
    const innerStart = polar(cx, cy, inner, end);
    const innerEnd = polar(cx, cy, inner, start);
    const d = [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${radius} ${radius} 0 ${large} 1 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerStart.x} ${innerStart.y}`,
      `A ${inner} ${inner} 0 ${large} 0 ${innerEnd.x} ${innerEnd.y}`,
      "Z",
    ].join(" ");
    const dimmed = Boolean(selected && slice.id !== selected);

    return { ...slice, d, dimmed };
  });

  function submitDraft() {
    closeAdd(true);
  }

  function startAdd() {
    const used = new Set(slices.map((slice) => slice.color.toLowerCase()));
    const next = SLICE_PALETTE.find((color) => !used.has(color.toLowerCase())) ?? SLICE_PALETTE[0];
    setDraftColor(next);
    setAdding(true);
    setPaletteOpen(false);
    onClear();
  }

  return (
    <div ref={rootRef} className="flex items-center gap-5">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
          {arcs.map((arc) => (
            <g
              key={arc.id}
              className="cursor-pointer"
              style={{
                transform: arc.dimmed ? "scale(0.78)" : "scale(1)",
                transformOrigin: `${cx}px ${cy}px`,
                transition: "transform 280ms ease",
              }}
              onClick={() => {
                closeAdd();
                onSelect(arc.id);
              }}
            >
              <path
                d={arc.d}
                fill={arc.dimmed ? fadeColor(arc.color) : arc.color}
                style={{ transition: "fill 280ms ease" }}
              />
            </g>
          ))}
        </svg>
        <button
          type="button"
          onClick={() => {
            if (adding) {
              closeAdd();
              return;
            }
            startAdd();
          }}
          className="absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center text-navy"
          aria-label={adding ? "Cancel new participant" : "Add participant"}
        >
          <svg
            data-slot="icon"
            fill="none"
            strokeWidth="1.5"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className="h-5 w-5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>

      {adding ? (
        <form
          className="relative min-w-0 flex-1 rounded-2xl bg-[#f3f4f6] px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.05)]"
          onSubmit={(event) => {
            event.preventDefault();
            submitDraft();
          }}
        >
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setPaletteOpen((open) => !open)}
              className="h-3.5 w-3.5 shrink-0 rounded-full"
              style={{ background: draftColor }}
              aria-label="Choose color"
            />
            <input
              type="text"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Name"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink/35"
              autoFocus
            />
            <div className="flex w-24 shrink-0 items-center gap-1">
              <input
                type="text"
                inputMode="decimal"
                value={draftAmount}
                onChange={(event) => setDraftAmount(event.target.value)}
                placeholder="0"
                className="w-full bg-transparent text-right font-mono text-xs text-ink outline-none placeholder:text-ink/35"
              />
              <span className="text-xs text-ink/45">€</span>
            </div>
          </div>
          {paletteOpen ? (
            <div className="absolute left-3 top-[calc(100%+8px)] z-10 grid grid-cols-5 gap-2 rounded-2xl bg-[#e8eaee] px-3 py-2.5 shadow-sm">
              {SLICE_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    setDraftColor(color);
                    setPaletteOpen(false);
                  }}
                  className="h-4 w-4 rounded-full"
                  style={{
                    background: color,
                    boxShadow: draftColor === color ? "0 0 0 2px #fff, 0 0 0 3px #0B1F3A" : undefined,
                  }}
                  aria-label={`Use color ${color}`}
                />
              ))}
            </div>
          ) : null}
        </form>
      ) : (
        <ul className="min-w-0 flex-1 space-y-2 text-sm">
          {visible.map((slice) => (
            <li key={slice.id}>
              <button
                type="button"
                onClick={() => onSelect(slice.id)}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-2 text-left text-ink"
              >
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: slice.color }} />
                  {slice.name}
                </span>
                <span className="font-mono text-xs">{formatEuro(slice.value)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function polar(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

function fadeColor(hex: string) {
  const raw = hex.replace("#", "");
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  const lift = (channel: number) => Math.round(channel + (236 - channel) * 0.52);
  return `rgb(${lift(r)} ${lift(g)} ${lift(b)})`;
}
