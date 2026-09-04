"use client";

import { useMemo, useState, useTransition } from "react";
import { addTransaction } from "@/lib/actions";
import type { Category, MoneyKind } from "@/lib/types";

type Props = {
  categories: Category[];
  today: string;
};

export function TransactionForm({ categories, today }: Props) {
  const [kind, setKind] = useState<MoneyKind>("expense");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(
    () => categories.filter((category) => category.kind === kind),
    [categories, kind],
  );

  return (
    <form
      className="grid gap-4"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await addTransaction(formData);
          if (!result.ok) {
            setError(result.error);
          }
        });
      }}
    >
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-ink/5 p-1">
        {(["expense", "income"] as const).map((value) => (
          <label
            key={value}
            className={`cursor-pointer rounded-lg px-3 py-2 text-center text-sm font-medium capitalize transition ${
              kind === value
                ? "bg-paper text-ink shadow-sm"
                : "text-ink/55 hover:text-ink"
            }`}
          >
            <input
              type="radio"
              name="kind"
              value={value}
              checked={kind === value}
              onChange={() => setKind(value)}
              className="sr-only"
            />
            {value}
          </label>
        ))}
      </div>

      <label className="grid gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-ink/50">
          Amount
        </span>
        <input
          name="amount"
          type="text"
          inputMode="decimal"
          required
          placeholder="0,00"
          className="h-11 rounded-xl border border-ink/10 bg-paper px-3 text-base outline-none ring-moss/30 focus:ring-2"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-ink/50">
          Category
        </span>
        <select
          name="categoryId"
          required
          className="h-11 rounded-xl border border-ink/10 bg-paper px-3 text-base outline-none ring-moss/30 focus:ring-2"
        >
          {filtered.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-ink/50">
          Date
        </span>
        <input
          name="occurredOn"
          type="date"
          required
          defaultValue={today}
          className="h-11 rounded-xl border border-ink/10 bg-paper px-3 text-base outline-none ring-moss/30 focus:ring-2"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-ink/50">
          Note
        </span>
        <input
          name="note"
          type="text"
          placeholder="Optional"
          className="h-11 rounded-xl border border-ink/10 bg-paper px-3 text-base outline-none ring-moss/30 focus:ring-2"
        />
      </label>

      {error ? <p className="text-sm text-brick">{error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-xl bg-moss text-sm font-semibold text-paper transition hover:bg-moss-dark disabled:opacity-60"
      >
        {pending ? "Saving…" : "Add transaction"}
      </button>
    </form>
  );
}
