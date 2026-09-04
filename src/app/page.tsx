import { TransactionForm } from "@/components/TransactionForm";
import { TransactionList } from "@/components/TransactionList";
import {
  currentYearMonth,
  formatEuros,
  todayIsoDate,
} from "@/lib/money";
import {
  getAllTimeNetCents,
  getMonthSummary,
  listCategories,
  listTransactions,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function Home() {
  const categories = listCategories();
  const transactions = listTransactions();
  const month = currentYearMonth();
  const summary = getMonthSummary(month);
  const net = getAllTimeNetCents();
  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString(
    "en-GB",
    { month: "long", year: "numeric" },
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-moss">
          Personal ledger
        </p>
        <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">
          Where the money went
        </h1>
        <p className="max-w-xl text-sm leading-6 text-ink/65">
          Stored locally in SQLite on this machine. Later this can become a PWA
          on your phone’s Home Screen.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl bg-ink px-5 py-6 text-paper sm:col-span-1">
          <p className="text-xs uppercase tracking-wide text-paper/55">
            All-time balance
          </p>
          <p className="mt-2 font-serif text-3xl tabular-nums">
            {formatEuros(net)}
          </p>
        </article>
        <article className="rounded-2xl border border-ink/10 bg-paper px-5 py-6">
          <p className="text-xs uppercase tracking-wide text-ink/45">
            Income · {monthLabel}
          </p>
          <p className="mt-2 font-serif text-3xl tabular-nums text-moss-dark">
            {formatEuros(summary.income_cents)}
          </p>
        </article>
        <article className="rounded-2xl border border-ink/10 bg-paper px-5 py-6">
          <p className="text-xs uppercase tracking-wide text-ink/45">
            Expenses · {monthLabel}
          </p>
          <p className="mt-2 font-serif text-3xl tabular-nums text-brick">
            {formatEuros(summary.expense_cents)}
          </p>
        </article>
      </section>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-ink/10 bg-paper p-5">
          <h2 className="mb-4 font-serif text-2xl">New entry</h2>
          <TransactionForm categories={categories} today={todayIsoDate()} />
        </section>

        <section className="min-w-0">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 className="font-serif text-2xl">Activity</h2>
            <p className="text-xs text-ink/45">
              {transactions.length}{" "}
              {transactions.length === 1 ? "entry" : "entries"}
            </p>
          </div>
          <TransactionList transactions={transactions} />
        </section>
      </div>
    </div>
  );
}
