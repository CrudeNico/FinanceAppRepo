"use client";

import { useMemo, useRef, useState } from "react";

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
  const latestYear = Math.max(yearOf(TODAY), ...entries.map((entry) => yearOf(entry.date)));
  const [openYears, setOpenYears] = useState<number[]>([latestYear]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [calendarFor, setCalendarFor] = useState<string | null>(null);
  const hold = useRef<number | null>(null);

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
    setSelectedId(null);
  }

  function update(id: string, patch: Partial<HistoryEntry>) {
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  }

  function startHold(id: string) {
    hold.current = window.setTimeout(() => {
      setSelectedId((current) => (current === id ? null : id));
    }, 2000);
  }

  function endHold() {
    if (hold.current) window.clearTimeout(hold.current);
    hold.current = null;
  }

  const calendarEntry = entries.find((entry) => entry.id === calendarFor) ?? null;

  return (
    <>
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-[17px] font-normal text-neutral-950">History</h2>
        <div className="flex items-center gap-3">
          {selectedId ? (
            <button type="button" onClick={() => {
              setEntries((current) => current.filter((entry) => entry.id !== selectedId));
              setSelectedId(null);
            }} aria-label="Delete row">
              <TrashIcon />
            </button>
          ) : null}
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
                <div>
                  <div className="flex items-center pb-1 text-[10px] font-semibold text-neutral-400">
                    <span className="w-[58px]">Date</span>
                    <span className="flex-1">Amt</span>
                    <span className="flex-1">Px</span>
                    <span className="w-12">FX</span>
                  </div>
                  {rows.length === 0 ? (
                    <p className="py-2 text-xs text-neutral-400">No buys yet</p>
                  ) : (
                    rows.map((entry) => (
                      <div
                        key={entry.id}
                        onPointerDown={() => startHold(entry.id)}
                        onPointerUp={endHold}
                        onPointerLeave={endHold}
                        className={`-mx-1.5 flex items-center rounded-lg px-1.5 py-1 ${
                          selectedId === entry.id ? "bg-neutral-200" : ""
                        }`}
                      >
                        <button
                          type="button"
                          className="w-[58px] text-left text-[13px] text-neutral-950"
                          onClick={() => setCalendarFor(entry.id)}
                        >
                          {formatDayMonth(entry.date)}
                        </button>
                        <input
                          value={entry.amount}
                          onChange={(event) => update(entry.id, { amount: event.target.value })}
                          placeholder="—"
                          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                        />
                        <input
                          value={entry.price}
                          onChange={(event) => update(entry.id, { price: event.target.value })}
                          placeholder="—"
                          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                        />
                        <input
                          value={entry.fx}
                          onChange={(event) => update(entry.id, { fx: event.target.value })}
                          placeholder="—"
                          className="w-12 bg-transparent text-[13px] outline-none"
                        />
                      </div>
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
        stroke="#111111"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
      />
    </svg>
  );
}
