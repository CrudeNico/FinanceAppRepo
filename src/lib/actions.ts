"use server";

import { revalidatePath } from "next/cache";
import { createTransaction, deleteTransaction } from "@/lib/queries";
import { parseAmountToCents } from "@/lib/money";
import type { MoneyKind } from "@/lib/types";

function isMoneyKind(value: FormDataEntryValue | null): value is MoneyKind {
  return value === "income" || value === "expense";
}

export async function addTransaction(formData: FormData) {
  const amountCents = parseAmountToCents(String(formData.get("amount") ?? ""));
  const kind = formData.get("kind");
  const categoryId = Number(formData.get("categoryId"));
  const note = String(formData.get("note") ?? "").trim();
  const occurredOn = String(formData.get("occurredOn") ?? "");

  if (!amountCents || !isMoneyKind(kind) || !categoryId || !occurredOn) {
    return { ok: false as const, error: "Fill in amount, type, category, and date." };
  }

  createTransaction({
    amountCents,
    kind,
    categoryId,
    note,
    occurredOn,
  });

  revalidatePath("/");
  return { ok: true as const };
}

export async function removeTransaction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) {
    return;
  }

  deleteTransaction(id);
  revalidatePath("/");
}
