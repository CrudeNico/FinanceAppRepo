import { Directory, File, Paths } from "expo-file-system";
import * as SQLite from "expo-sqlite";
import { INITIAL_HISTORY, type HistoryEntry } from "./assetData";
import { DEFAULT_CATEGORY_GROUPS, type CategoryGroup } from "./cashflowCategories";
import type { CashflowEntry, DayEntry, TradeRow } from "./models";
import { INITIAL_STOCKS, type ListedStock } from "./stockList";

export type CardKind = "stock" | "trading" | "cashflow";

let db: SQLite.SQLiteDatabase | null = null;
let opening: Promise<SQLite.SQLiteDatabase> | null = null;
let activeFile = "finance.db";
let categoryLock: Promise<void> = Promise.resolve();

function withCategoryLock<T>(fn: () => Promise<T>) {
  const run = categoryLock.then(fn, fn);
  categoryLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

const CASHFLOW_TABLE = `
    CREATE TABLE IF NOT EXISTS cashflow_entries (
      id TEXT PRIMARY KEY NOT NULL,
      card_id TEXT NOT NULL,
      date TEXT NOT NULL,
      kind TEXT NOT NULL,
      amount TEXT NOT NULL,
      label TEXT NOT NULL,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS cashflow_groups (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'other',
      color TEXT NOT NULL DEFAULT '#6B7280',
      saved INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cashflow_items (
      id TEXT PRIMARY KEY NOT NULL,
      group_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      FOREIGN KEY (group_id) REFERENCES cashflow_groups(id) ON DELETE CASCADE
    );
`;

export async function closeDb() {
  if (opening) await opening.catch(() => undefined);
  if (db) {
    await db.closeAsync().catch(() => undefined);
    db = null;
  }
  opening = null;
}

export async function initDb(file = "finance.db") {
  if (db && activeFile === file) {
    await db.execAsync(CASHFLOW_TABLE);
    await seedCategories(db);
    return db;
  }
  if (db) await closeDb();
  if (opening) return opening;
  opening = (async () => {
    activeFile = file;
    const database = await SQLite.openDatabaseAsync(file);
    await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY NOT NULL,
      kind TEXT NOT NULL,
      ticker TEXT NOT NULL,
      name TEXT NOT NULL,
      image TEXT,
      letter TEXT,
      color TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stock_history (
      id TEXT PRIMARY KEY NOT NULL,
      card_id TEXT NOT NULL,
      date TEXT NOT NULL,
      amount TEXT NOT NULL,
      price TEXT NOT NULL,
      fx TEXT NOT NULL,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS trading_months (
      id TEXT PRIMARY KEY NOT NULL,
      card_id TEXT NOT NULL,
      month TEXT NOT NULL,
      gain TEXT NOT NULL,
      loss TEXT NOT NULL,
      deposit TEXT NOT NULL,
      withdrawal TEXT NOT NULL,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS trading_days (
      card_id TEXT NOT NULL,
      date TEXT NOT NULL,
      gain TEXT NOT NULL,
      loss TEXT NOT NULL,
      PRIMARY KEY (card_id, date),
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS cashflow_entries (
      id TEXT PRIMARY KEY NOT NULL,
      card_id TEXT NOT NULL,
      date TEXT NOT NULL,
      kind TEXT NOT NULL,
      amount TEXT NOT NULL,
      label TEXT NOT NULL,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS cashflow_groups (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'other',
      color TEXT NOT NULL DEFAULT '#6B7280',
      saved INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cashflow_items (
      id TEXT PRIMARY KEY NOT NULL,
      group_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      FOREIGN KEY (group_id) REFERENCES cashflow_groups(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
    db = database;
    await seedIfNeeded(database, file === "finance.db");
    await seedCategories(database);
    return database;
  })();
  try {
    return await opening;
  } finally {
    opening = null;
  }
}

async function getDb() {
  return db ?? (await initDb());
}

async function migrateCategoryColumns(database: SQLite.SQLiteDatabase) {
  const cols = await database.getAllAsync<{ name: string }>("PRAGMA table_info(cashflow_groups)");
  const names = new Set(cols.map((col) => col.name));
  if (!names.has("icon")) await database.execAsync("ALTER TABLE cashflow_groups ADD COLUMN icon TEXT");
  if (!names.has("color")) await database.execAsync("ALTER TABLE cashflow_groups ADD COLUMN color TEXT");
  if (!names.has("saved")) await database.execAsync("ALTER TABLE cashflow_groups ADD COLUMN saved INTEGER");
  for (const group of DEFAULT_CATEGORY_GROUPS) {
    await database.runAsync(
      "UPDATE cashflow_groups SET icon = COALESCE(NULLIF(icon, ''), ?), color = COALESCE(NULLIF(color, ''), ?), saved = COALESCE(saved, 1) WHERE id = ?",
      group.icon,
      group.color,
      group.id,
    );
  }
  await database.runAsync(
    "UPDATE cashflow_groups SET icon = COALESCE(NULLIF(icon, ''), 'other'), color = COALESCE(NULLIF(color, ''), '#6B7280'), saved = COALESCE(saved, 1)",
  );
}

async function seedCategories(database: SQLite.SQLiteDatabase) {
  await withCategoryLock(async () => {
  await migrateCategoryColumns(database);
  const row = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM cashflow_groups",
  );
  if ((row?.count ?? 0) > 0) {
    const items = await database.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM cashflow_items",
    );
    if ((items?.count ?? 0) === 0) {
      for (const group of DEFAULT_CATEGORY_GROUPS) {
        for (const [itemIndex, item] of group.items.entries()) {
          await database.runAsync(
            "INSERT OR IGNORE INTO cashflow_items (id, group_id, name, sort_order) VALUES (?, ?, ?, ?)",
            item.id,
            group.id,
            item.name,
            itemIndex,
          );
        }
      }
    }
    return;
  }
  for (const [groupIndex, group] of DEFAULT_CATEGORY_GROUPS.entries()) {
    await database.runAsync(
      "INSERT INTO cashflow_groups (id, name, kind, icon, color, saved, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
      group.id,
      group.name,
      group.kind,
      group.icon,
      group.color,
      1,
      groupIndex,
    );
    for (const [itemIndex, item] of group.items.entries()) {
      await database.runAsync(
        "INSERT INTO cashflow_items (id, group_id, name, sort_order) VALUES (?, ?, ?, ?)",
        item.id,
        group.id,
        item.name,
        itemIndex,
      );
    }
  }
  });
}

async function seedIfNeeded(database: SQLite.SQLiteDatabase, seedDemoStock: boolean) {
  if (seedDemoStock) {
    const row = await database.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM cards WHERE kind = 'stock'",
    );
    if ((row?.count ?? 0) === 0) {
      const stock = INITIAL_STOCKS[0];
      if (stock) {
        await upsertCard("stock", { ...stock, saved: true });
        await saveStockHistory(stock.id, INITIAL_HISTORY);
      }
    }
  }
  const cash = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM cards WHERE kind = 'cashflow'",
  );
  if ((cash?.count ?? 0) > 0) return;
  await upsertCard("cashflow", {
    id: "cashflow",
    ticker: "CASH",
    name: "Cashflow",
    image: null,
    letter: "C",
    color: "#3B82F6",
    saved: true,
  });
}

export async function listCards(kind: CardKind): Promise<ListedStock[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<{
    id: string;
    ticker: string;
    name: string;
    image: string | null;
    letter: string | null;
    color: string | null;
  }>("SELECT id, ticker, name, image, letter, color FROM cards WHERE kind = ? ORDER BY created_at ASC", kind);
  return rows.map((row) => ({
    id: row.id,
    ticker: row.ticker,
    name: row.name,
    image: row.image,
    letter: row.letter ?? undefined,
    color: row.color ?? undefined,
    saved: true,
  }));
}

export async function upsertCard(kind: CardKind, card: ListedStock) {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO cards (id, kind, ticker, name, image, letter, color, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       ticker = excluded.ticker,
       name = excluded.name,
       image = excluded.image,
       letter = excluded.letter,
       color = excluded.color`,
    card.id,
    kind,
    card.ticker,
    card.name,
    card.image ?? null,
    card.letter ?? null,
    card.color ?? null,
    Date.now(),
  );
}

export async function deleteCard(id: string) {
  const database = await getDb();
  await database.runAsync("DELETE FROM cards WHERE id = ?", id);
}

export async function loadStockHistory(cardId: string): Promise<HistoryEntry[]> {
  const database = await getDb();
  return database.getAllAsync<HistoryEntry>(
    "SELECT id, date, amount, price, fx FROM stock_history WHERE card_id = ? ORDER BY date DESC",
    cardId,
  );
}

export async function saveStockHistory(cardId: string, entries: HistoryEntry[]) {
  const database = await getDb();
  await database.withTransactionAsync(async () => {
    await database.runAsync("DELETE FROM stock_history WHERE card_id = ?", cardId);
    for (const entry of entries) {
      await database.runAsync(
        "INSERT INTO stock_history (id, card_id, date, amount, price, fx) VALUES (?, ?, ?, ?, ?, ?)",
        entry.id,
        cardId,
        entry.date,
        entry.amount,
        entry.price,
        entry.fx,
      );
    }
  });
}

export async function loadTradingMonths(cardId: string): Promise<TradeRow[]> {
  const database = await getDb();
  return database.getAllAsync<TradeRow>(
    "SELECT id, month, gain, loss, deposit, withdrawal FROM trading_months WHERE card_id = ? ORDER BY month DESC",
    cardId,
  );
}

export async function saveTradingMonths(cardId: string, entries: TradeRow[]) {
  const database = await getDb();
  await database.withTransactionAsync(async () => {
    await database.runAsync("DELETE FROM trading_months WHERE card_id = ?", cardId);
    for (const entry of entries) {
      await database.runAsync(
        "INSERT INTO trading_months (id, card_id, month, gain, loss, deposit, withdrawal) VALUES (?, ?, ?, ?, ?, ?, ?)",
        entry.id,
        cardId,
        entry.month,
        entry.gain,
        entry.loss,
        entry.deposit,
        entry.withdrawal,
      );
    }
  });
}

export async function loadTradingDays(cardId: string): Promise<Record<string, DayEntry>> {
  const database = await getDb();
  const rows = await database.getAllAsync<{ date: string; gain: string; loss: string }>(
    "SELECT date, gain, loss FROM trading_days WHERE card_id = ?",
    cardId,
  );
  const map: Record<string, DayEntry> = {};
  rows.forEach((row) => {
    map[row.date] = { gain: row.gain, loss: row.loss };
  });
  return map;
}

export async function saveTradingDays(cardId: string, days: Record<string, DayEntry>) {
  const database = await getDb();
  await database.withTransactionAsync(async () => {
    await database.runAsync("DELETE FROM trading_days WHERE card_id = ?", cardId);
    for (const [date, entry] of Object.entries(days)) {
      await database.runAsync(
        "INSERT INTO trading_days (card_id, date, gain, loss) VALUES (?, ?, ?, ?)",
        cardId,
        date,
        entry.gain,
        entry.loss,
      );
    }
  });
}

export async function loadCashflowEntries(cardId: string): Promise<CashflowEntry[]> {
  const database = await getDb();
  return database.getAllAsync<CashflowEntry>(
    "SELECT id, date, kind, amount, label FROM cashflow_entries WHERE card_id = ? ORDER BY date DESC",
    cardId,
  );
}

export async function loadCategoryGroups(): Promise<CategoryGroup[]> {
  const database = await getDb();
  await withCategoryLock(() => migrateCategoryColumns(database));
  const groups = await database.getAllAsync<{
    id: string;
    name: string;
    kind: "income" | "expense";
    icon: string | null;
    color: string | null;
    saved: number | null;
    sort_order: number;
  }>("SELECT id, name, kind, icon, color, saved, sort_order FROM cashflow_groups ORDER BY sort_order ASC");
  const items = await database.getAllAsync<{
    id: string;
    group_id: string;
    name: string;
    sort_order: number;
  }>("SELECT id, group_id, name, sort_order FROM cashflow_items ORDER BY sort_order ASC");
  const defaults = new Map(DEFAULT_CATEGORY_GROUPS.map((group) => [group.id, group]));
  return groups.map((group) => {
    const preset = defaults.get(group.id);
    return {
      id: group.id,
      name: group.name,
      kind: group.kind,
      icon: group.icon || preset?.icon || "other",
      color: group.color || preset?.color || "#6B7280",
      saved: (group.saved ?? 1) === 1,
      items: items
        .filter((item) => item.group_id === group.id)
        .map((item) => ({ id: item.id, name: item.name })),
    };
  });
}

export async function saveCategoryGroups(groups: CategoryGroup[]) {
  const database = await getDb();
  await withCategoryLock(async () => {
  await migrateCategoryColumns(database);
  await database.withTransactionAsync(async () => {
    await database.runAsync("DELETE FROM cashflow_items");
    await database.runAsync("DELETE FROM cashflow_groups");
    for (const [groupIndex, group] of groups.entries()) {
      await database.runAsync(
        "INSERT INTO cashflow_groups (id, name, kind, icon, color, saved, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        group.id,
        group.name ?? "",
        group.kind ?? "expense",
        group.icon ?? "other",
        group.color ?? "#6B7280",
        group.saved === false ? 0 : 1,
        groupIndex,
      );
      for (const [itemIndex, item] of (group.items ?? []).entries()) {
        await database.runAsync(
          "INSERT INTO cashflow_items (id, group_id, name, sort_order) VALUES (?, ?, ?, ?)",
          item.id,
          group.id,
          item.name ?? "",
          itemIndex,
        );
      }
    }
  });
  });
}

export async function saveCashflowEntries(cardId: string, entries: CashflowEntry[]) {
  const database = await getDb();
  await database.withTransactionAsync(async () => {
    await database.runAsync("DELETE FROM cashflow_entries WHERE card_id = ?", cardId);
    for (const entry of entries) {
      await database.runAsync(
        "INSERT INTO cashflow_entries (id, card_id, date, kind, amount, label) VALUES (?, ?, ?, ?, ?, ?)",
        entry.id ?? `c${Date.now()}`,
        cardId,
        entry.date ?? "",
        entry.kind ?? "expense",
        entry.amount ?? "",
        entry.label ?? "",
      );
    }
  });
}

export async function getSetting(key: string) {
  const database = await getDb();
  await database.execAsync(
    "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)",
  );
  const row = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    key,
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  const database = await getDb();
  await database.execAsync(
    "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)",
  );
  await database.runAsync(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    value,
  );
}

export async function persistLogo(id: string, uri: string) {
  try {
    const folder = new Directory(Paths.document, "logos");
    if (!folder.exists) folder.create();
    const ext = uri.split(".").pop()?.split("?")[0] || "jpg";
    const dest = new File(folder, `${id}.${ext}`);
    if (dest.exists) dest.delete();
    await new File(uri).copy(dest);
    return dest.uri;
  } catch {
    return uri;
  }
}
