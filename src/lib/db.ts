import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const globalForDb = globalThis as unknown as {
  financeDb?: Database.Database;
};

const DEFAULT_CATEGORIES: { name: string; kind: "income" | "expense" }[] = [
  { name: "Salary", kind: "income" },
  { name: "Freelance", kind: "income" },
  { name: "Refund", kind: "income" },
  { name: "Other income", kind: "income" },
  { name: "Groceries", kind: "expense" },
  { name: "Rent", kind: "expense" },
  { name: "Transport", kind: "expense" },
  { name: "Dining", kind: "expense" },
  { name: "Bills", kind: "expense" },
  { name: "Health", kind: "expense" },
  { name: "Shopping", kind: "expense" },
  { name: "Other expense", kind: "expense" },
];

function createDb() {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });

  const db = new Database(path.join(dir, "finance.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('income', 'expense'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
      category_id INTEGER NOT NULL REFERENCES categories(id),
      note TEXT NOT NULL DEFAULT '',
      occurred_on TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const count = db.prepare("SELECT COUNT(*) AS n FROM categories").get() as {
    n: number;
  };
  if (count.n === 0) {
    const insert = db.prepare(
      "INSERT INTO categories (name, kind) VALUES (?, ?)",
    );
    const seed = db.transaction(() => {
      for (const category of DEFAULT_CATEGORIES) {
        insert.run(category.name, category.kind);
      }
    });
    seed();
  }

  return db;
}

export function getDb() {
  if (!globalForDb.financeDb) {
    globalForDb.financeDb = createDb();
  }
  return globalForDb.financeDb;
}
