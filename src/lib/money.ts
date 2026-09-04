export function formatEuros(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function parseAmountToCents(raw: string) {
  const normalized = raw.replace(",", ".").trim();
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value * 100);
}

export function currentYearMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}
