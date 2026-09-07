"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { loadHistory, saveHistory } from "@/lib/historyStore";

type HistoryEntry = {
  id: string;
  date: string;
  amount: string;
  price: string;
  fx: string;
};

const TODAY = "2026-09-05";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const INITIAL_HISTORY: HistoryEntry[] = [
  { id: "h1", date: "2026-03-12", amount: "1200", price: "152.10", fx: "" },
  { id: "h2", date: "2026-01-08", amount: "800", price: "148.40", fx: "" },
  { id: "h3", date: "2025-11-20", amount: "1500", price: "141.20", fx: "1.08" },
];

function yearOf(iso: string) {
  return Number(iso.slice(0, 4));
}

function formatDayMonth(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  return `${date.getDate()} ${date.toLocaleDateString("en-GB", { month: "short" })}`;
}

export function HistoryCard() {
  const [entries, setEntries] = useState<HistoryEntry[]>(INITIAL_HISTORY);
  const [ready, setReady] = useState(false);
  const latestYear = Math.max(yearOf(TODAY), ...entries.map((entry) => yearOf(entry.date)));
  const [openYears, setOpenYears] = useState<number[]>([latestYear]);
  const [openSwipe, setOpenSwipe] = useState<string | null>(null);
  const [calendarFor, setCalendarFor] = useState<string | null>(null);

  useEffect(() => {
    loadHistory()
      .then((rows) => {
        if (rows.length > 0) setEntries(rows);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveHistory(entries).catch(() => undefined);
  }, [entries, ready]);

  const years = useMemo(() => {
    const set = new Set(entries.map((entry) => yearOf(entry.date)));
    set.add(yearOf(TODAY));
    return [...set].sort((a, b) => b - a);
  }, [entries]);

  function toggleYear(year: number) {
    setOpenYears((current) =>
      current.includes(year) ? current.filter((item) => item !== year) : [...current, year],
    );
  }

  function addRow() {
    const id = `h${Date.now()}`;
    setEntries((current) => [{ id, date: TODAY, amount: "", price: "", fx: "" }, ...current]);
    setOpenYears((current) => (current.includes(latestYear) ? current : [latestYear, ...current]));
    setOpenSwipe(null);
  }

  function update(id: string, patch: Partial<HistoryEntry>) {
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  }

  function remove(id: string) {
    setEntries((current) => current.filter((entry) => entry.id !== id));
    setOpenSwipe(null);
  }

  const calendarEntry = entries.find((entry) => entry.id === calendarFor) ?? null;

  return (
    <>
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-[17px] font-normal text-neutral-950">History</h2>
        <div className="flex items-center gap-3">
          <button type="button" onClick={addRow} className="text-2xl font-light leading-none text-neutral-950">
            +
          </button>
        </div>
      </div>

      <section className="mt-3 rounded-[22px] border border-neutral-200 px-3.5 py-2.5">
        {years.map((year) => {
          const open = openYears.includes(year);
          const rows = entries
            .filter((entry) => yearOf(entry.date) === year)
            .sort((a, b) => (a.date < b.date ? 1 : -1));
          return (
            <div key={year} className="py-1.5">
              <button
                type="button"
                onClick={() => toggleYear(year)}
                className="flex w-full items-center justify-between py-1.5"
              >
                <span className="text-[15px] text-neutral-950">{year}</span>
                {open ? <ChevronUp /> : <ChevronDown />}
              </button>
              {open ? (
                <div className="overflow-hidden rounded-[10px] border border-[#E8E8E8]">
                  <div className="flex items-center border-b border-[#E8E8E8] bg-[#FAFAFA] text-[10px] font-semibold text-neutral-400">
                    <span className="w-[62px] px-1.5 py-1.5">Date</span>
                    <span className="flex-1 border-l border-[#E8E8E8] px-1.5 py-1.5">Amt</span>
                    <span className="flex-1 border-l border-[#E8E8E8] px-1.5 py-1.5">Px</span>
                    <span className="w-[52px] border-l border-[#E8E8E8] px-1.5 py-1.5">FX</span>
                  </div>
                  {rows.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-neutral-400">No buys yet</p>
                  ) : (
                    rows.map((entry, index) => (
                      <SwipeRow
                        key={entry.id}
                        entry={entry}
                        last={index === rows.length - 1}
                        open={openSwipe === entry.id}
                        onOpen={() => setOpenSwipe(entry.id)}
                        onClose={() => setOpenSwipe((current) => (current === entry.id ? null : current))}
                        onDelete={() => remove(entry.id)}
                        onDate={() => setCalendarFor(entry.id)}
                        onUpdate={(patch) => update(entry.id, patch)}
                      />
                    ))
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      {calendarEntry ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/25 p-6"
          onClick={() => setCalendarFor(null)}
        >
          <div
            className="w-[280px] rounded-2xl bg-white p-3.5"
            onClick={(event) => event.stopPropagation()}
          >
            <MiniCalendar
              value={calendarEntry.date}
              onChange={(date) => {
                update(calendarEntry.id, { date });
                setCalendarFor(null);
                const year = yearOf(date);
                setOpenYears((current) => (current.includes(year) ? current : [...current, year]));
              }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

const ACTION = 68;

function SwipeRow({
  entry,
  last,
  open,
  onOpen,
  onClose,
  onDelete,
  onDate,
  onUpdate,
}: {
  entry: HistoryEntry;
  last: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onDelete: () => void;
  onDate: () => void;
  onUpdate: (patch: Partial<HistoryEntry>) => void;
}) {
  const startX = useRef(0);
  const localX = useRef(0);
  const startOffset = useRef(0);
  const amountRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const fxRef = useRef<HTMLInputElement>(null);
  const [x, setX] = useState(0);

  useEffect(() => {
    setX(open ? ACTION : 0);
  }, [open]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    startX.current = event.clientX;
    localX.current = event.nativeEvent.offsetX;
    startOffset.current = open ? ACTION : 0;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const next = Math.max(0, Math.min(ACTION, startOffset.current + event.clientX - startX.current));
    setX(next);
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const dx = event.clientX - startX.current;
    if (Math.abs(dx) < 8) {
      if (open) {
        onClose();
        return;
      }
      const width = event.currentTarget.clientWidth || 1;
      const dateW = 62;
      const fxW = 52;
      const mid = Math.max((width - dateW - fxW) / 2, 1);
      const tap = localX.current;
      if (tap < dateW) onDate();
      else if (tap < dateW + mid) amountRef.current?.focus();
      else if (tap < dateW + mid + mid) priceRef.current?.focus();
      else fxRef.current?.focus();
      return;
    }
    if (dx > 8) {
      setX(ACTION);
      onOpen();
      return;
    }
    if (dx < -8) {
      setX(0);
      onClose();
      return;
    }
    const next = startOffset.current + dx;
    const shouldOpen = next > ACTION / 2;
    setX(shouldOpen ? ACTION : 0);
    if (shouldOpen) onOpen();
    else onClose();
  }

  return (
    <div className={`relative overflow-hidden ${last ? "" : "border-b border-[#E8E8E8]"}`}>
      <button
        type="button"
        onClick={onDelete}
        className="absolute inset-y-0 left-0 flex w-[68px] items-center justify-center bg-red-600"
        aria-label="Delete row"
      >
        <TrashIcon />
      </button>
      <div
        className="relative flex min-h-9 touch-pan-y items-center bg-white"
        style={{ transform: `translateX(${x}px)` }}
      >
        <button
          type="button"
          className="w-[62px] px-1.5 text-left text-[13px] text-neutral-950"
          onClick={open ? onClose : onDate}
        >
          {formatDayMonth(entry.date)}
        </button>
        <input
          ref={amountRef}
          value={entry.amount}
          onChange={(event) => onUpdate({ amount: event.target.value })}
          placeholder="—"
          className="min-w-0 flex-1 border-l border-[#E8E8E8] bg-transparent px-1.5 py-2 text-[13px] outline-none"
        />
        <input
          ref={priceRef}
          value={entry.price}
          onChange={(event) => onUpdate({ price: event.target.value })}
          placeholder="—"
          className="min-w-0 flex-1 border-l border-[#E8E8E8] bg-transparent px-1.5 py-2 text-[13px] outline-none"
        />
        <input
          ref={fxRef}
          value={entry.fx}
          onChange={(event) => onUpdate({ fx: event.target.value })}
          placeholder="—"
          className="w-[52px] border-l border-[#E8E8E8] bg-transparent px-1.5 py-2 text-[13px] outline-none"
        />
        <div
          className="absolute inset-0"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
    </div>
  );
}

function MiniCalendar({
  value,
  onChange,
}: {
  value: string;
  onChange: (date: string) => void;
}) {
  const selected = new Date(`${value}T00:00:00`);
  const [cursor, setCursor] = useState(new Date(selected));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1).getDay();
  const startPad = first === 0 ? 6 : first - 1;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(startPad).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <button type="button" onClick={() => setCursor(new Date(year, month - 1, 1))} className="px-1.5 text-[22px]">
          ‹
        </button>
        <p className="text-[15px] text-neutral-950">
          {MONTHS[month]} {year}
        </p>
        <button type="button" onClick={() => setCursor(new Date(year, month + 1, 1))} className="px-1.5 text-[22px]">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-neutral-400">
        {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, index) => {
          if (!day) return <span key={`e${index}`} />;
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const on = iso === value;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onChange(iso)}
              className="grid aspect-square place-items-center"
            >
              <span
                className={`grid h-[30px] w-[30px] place-items-center rounded-full text-[13px] ${
                  on ? "bg-neutral-950 text-white" : "text-neutral-950"
                }`}
              >
                {day}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChevronDown() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke="#9CA3AF"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="m19.5 8.25-7.5 7.5-7.5-7.5"
      />
    </svg>
  );
}

function ChevronUp() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke="#9CA3AF"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="m4.5 15.75 7.5-7.5 7.5 7.5"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke="#ffffff"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
      />
    </svg>
  );
}
