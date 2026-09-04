import { removeTransaction } from "@/lib/actions";
import { formatEuros } from "@/lib/money";
import type { Transaction } from "@/lib/types";

type Props = {
  transactions: Transaction[];
};

export function TransactionList({ transactions }: Props) {
  if (transactions.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-ink/15 px-5 py-10 text-center text-sm text-ink/55">
        No transactions yet. Add income or an expense to start the ledger.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-paper">
      {transactions.map((transaction) => {
        const isIncome = transaction.kind === "income";
        return (
          <li
            key={transaction.id}
            className="flex items-center gap-4 px-4 py-3.5 sm:px-5"
          >
            <div
              className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                isIncome ? "bg-moss" : "bg-brick"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">
                {transaction.note || transaction.category_name}
              </p>
              <p className="text-xs text-ink/50">
                {transaction.category_name} · {transaction.occurred_on}
              </p>
            </div>
            <p
              className={`font-mono text-sm tabular-nums ${
                isIncome ? "text-moss-dark" : "text-brick"
              }`}
            >
              {isIncome ? "+" : "−"}
              {formatEuros(transaction.amount_cents)}
            </p>
            <form action={removeTransaction}>
              <input type="hidden" name="id" value={transaction.id} />
              <button
                type="submit"
                className="rounded-lg px-2 py-1 text-xs text-ink/40 transition hover:bg-ink/5 hover:text-brick"
                aria-label={`Delete ${transaction.note || transaction.category_name}`}
              >
                Delete
              </button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
