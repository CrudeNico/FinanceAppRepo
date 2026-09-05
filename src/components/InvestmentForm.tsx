"use client";

import { useState } from "react";
import {
  FUNDS,
  type Currency,
  type FundId,
  type Investment,
} from "@/lib/portfolio";

type Props = {
  fundId: FundId;
  initial?: Investment | null;
  onSave: (draft: Omit<Investment, "id"> & { id?: string }) => void;
  onCancel: () => void;
};

export function InvestmentForm({ fundId, initial, onSave, onCancel }: Props) {
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? "EUR");

  return (
    <form
      className="grid gap-3 rounded-2xl border border-ink/10 bg-beige-deep/40 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const nextCurrency = String(data.get("currency")) as Currency;
        const amountEur = Number(data.get("amountEur"));
        const sharePrice = Number(data.get("sharePrice"));
        const fxRate = nextCurrency === "USD" ? Number(data.get("fxRate")) : 1;
        if (!amountEur || !sharePrice || (nextCurrency === "USD" && !fxRate)) {
          return;
        }
        onSave({
          id: initial?.id,
          fundId: String(data.get("fundId")) as FundId,
          date: String(data.get("date")),
          amountEur,
          sharePrice,
          currency: nextCurrency,
          fxRate,
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs uppercase tracking-wide text-taupe">
          Fund
          <select
            name="fundId"
            defaultValue={initial?.fundId ?? fundId}
            className="h-10 rounded-lg border border-ink/10 bg-beige px-3 text-sm text-ink"
          >
            {FUNDS.map((fund) => (
              <option key={fund.id} value={fund.id}>
                {fund.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs uppercase tracking-wide text-taupe">
          Date
          <input
            name="date"
            type="date"
            required
            defaultValue={initial?.date ?? new Date().toISOString().slice(0, 10)}
            className="h-10 rounded-lg border border-ink/10 bg-beige px-3 text-sm text-ink"
          />
        </label>
        <label className="grid gap-1 text-xs uppercase tracking-wide text-taupe">
          Amount invested (EUR)
          <input
            name="amountEur"
            type="number"
            step="0.01"
            min="1"
            required
            defaultValue={initial?.amountEur ?? ""}
            className="h-10 rounded-lg border border-ink/10 bg-beige px-3 text-sm text-ink"
          />
        </label>
        <label className="grid gap-1 text-xs uppercase tracking-wide text-taupe">
          Share price
          <input
            name="sharePrice"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={initial?.sharePrice ?? ""}
            className="h-10 rounded-lg border border-ink/10 bg-beige px-3 text-sm text-ink"
          />
        </label>
        <label className="grid gap-1 text-xs uppercase tracking-wide text-taupe">
          Price currency
          <select
            name="currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value as Currency)}
            className="h-10 rounded-lg border border-ink/10 bg-beige px-3 text-sm text-ink"
          >
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </label>
        {currency === "USD" ? (
          <label className="grid gap-1 text-xs uppercase tracking-wide text-taupe">
            FX rate (EUR per 1 USD)
            <input
              name="fxRate"
              type="number"
              step="0.0001"
              min="0.01"
              required
              defaultValue={initial?.fxRate && initial.currency === "USD" ? initial.fxRate : 0.92}
              className="h-10 rounded-lg border border-ink/10 bg-beige px-3 text-sm text-ink"
            />
          </label>
        ) : null}
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-lg px-3 text-sm text-taupe hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="h-9 rounded-lg bg-ink px-4 text-sm text-beige"
        >
          Save entry
        </button>
      </div>
    </form>
  );
}
