export type MoneyKind = "income" | "expense";

export type Category = {
  id: number;
  name: string;
  kind: MoneyKind;
};

export type Transaction = {
  id: number;
  amount_cents: number;
  kind: MoneyKind;
  category_id: number;
  category_name: string;
  note: string;
  occurred_on: string;
  created_at: string;
};

export type MonthSummary = {
  income_cents: number;
  expense_cents: number;
  net_cents: number;
};
