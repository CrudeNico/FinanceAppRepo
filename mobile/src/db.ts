import { Directory, File, Paths } from "expo-file-system";
import * as SQLite from "expo-sqlite";
import { INITIAL_HISTORY, type HistoryEntry } from "./assetData";
import type { DayEntry, TradeRow } from "./models";
import { INITIAL_STOCKS, type ListedStock } from "./stockList";

export type CardKind = "stock" | "trading";

let db: SQLite.SQLiteDatabase | null = null;
let opening: Promise<SQLite.SQLiteDatabase> | null = null;

export async function initDb() {
  if (db) return db;
  if (opening) return opening;
  opening = (async () => {
    const database = await SQLite.openDatabaseAsync("finance.db");
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
  `);
    db = database;
    await seedIfNeeded(database);
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

async function seedIfNeeded(database: SQLite.SQLiteDatabase) {
  const row = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM cards WHERE kind = 'stock'",
  );
  if ((row?.count ?? 0) > 0) return;
  const stock = INITIAL_STOCKS[0];
  if (!stock) return;
  await upsertCard("stock", { ...stock, saved: true });
  await saveStockHistory(stock.id, INITIAL_HISTORY);
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
