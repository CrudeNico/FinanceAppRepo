import { getDb } from "@/lib/db";
import type { Category, MonthSummary, MoneyKind, Transaction } from "@/lib/types";

export function listCategories(): Category[] {
  return getDb()
    .prepare(
      "SELECT id, name, kind FROM categories ORDER BY kind ASC, name ASC",
    )
    .all() as Category[];
}

export function listTransactions(): Transaction[] {
  return getDb()
    .prepare(
      `
      SELECT
        t.id,
        t.amount_cents,
        t.kind,
        t.category_id,
        c.name AS category_name,
        t.note,
        t.occurred_on,
        t.created_at
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
      ORDER BY t.occurred_on DESC, t.id DESC
      `,
    )
    .all() as Transaction[];
}

export function getMonthSummary(yearMonth: string): MonthSummary {
  const row = getDb()
    .prepare(
      `
      SELECT
        COALESCE(SUM(CASE WHEN kind = 'income' THEN amount_cents ELSE 0 END), 0) AS income_cents,
        COALESCE(SUM(CASE WHEN kind = 'expense' THEN amount_cents ELSE 0 END), 0) AS expense_cents
      FROM transactions
      WHERE strftime('%Y-%m', occurred_on) = ?
      `,
    )
    .get(yearMonth) as { income_cents: number; expense_cents: number };

  return {
    income_cents: row.income_cents,
    expense_cents: row.expense_cents,
    net_cents: row.income_cents - row.expense_cents,
  };
}

export function getAllTimeNetCents(): number {
  const row = getDb()
    .prepare(
      `
      SELECT
        COALESCE(SUM(CASE WHEN kind = 'income' THEN amount_cents ELSE -amount_cents END), 0) AS net_cents
      FROM transactions
      `,
    )
    .get() as { net_cents: number };

  return row.net_cents;
}

export function createTransaction(input: {
  amountCents: number;
  kind: MoneyKind;
  categoryId: number;
  note: string;
  occurredOn: string;
}) {
  const category = getDb()
    .prepare("SELECT id, kind FROM categories WHERE id = ?")
    .get(input.categoryId) as { id: number; kind: MoneyKind } | undefined;

  if (!category) {
    throw new Error("Category not found.");
  }
  if (category.kind !== input.kind) {
    throw new Error("Category does not match income or expense.");
  }

  getDb()
    .prepare(
      `
      INSERT INTO transactions (amount_cents, kind, category_id, note, occurred_on)
      VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(
      input.amountCents,
      input.kind,
      input.categoryId,
      input.note,
      input.occurredOn,
    );
}

export function deleteTransaction(id: number) {
  getDb().prepare("DELETE FROM transactions WHERE id = ?").run(id);
}
