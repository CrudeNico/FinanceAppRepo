import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  listAll,
  ref,
  uploadBytes,
  type StorageReference,
} from "firebase/storage";
import { INITIAL_HISTORY } from "./assetData";
import { DEFAULT_CATEGORY_GROUPS, type CategoryGroup } from "./cashflowCategories";
import { getFirebaseStorage, getFirestoreDb } from "./firebase";
import type { CashflowEntry, DayEntry, TradeRow } from "./models";
import { INITIAL_STOCKS, type ListedStock } from "./stockList";

export type CardKind = "stock" | "trading" | "cashflow";

let activeId: string | null = null;
let categoryLock: Promise<void> = Promise.resolve();

function withCategoryLock<T>(fn: () => Promise<T>) {
  const run = categoryLock.then(fn, fn);
  categoryLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function db() {
  return getFirestoreDb();
}

function profileRef() {
  if (!activeId) throw new Error("No profile");
  return doc(db(), "profiles", activeId);
}

function col(name: string) {
  return collection(profileRef(), name);
}

function item(name: string, id: string) {
  return doc(col(name), id);
}

async function replaceWhere(name: string, field: string, value: string, rows: Record<string, unknown>[]) {
  const snap = await getDocs(query(col(name), where(field, "==", value)));
  const existing = snap.docs;
  const chunk = 400;
  for (let i = 0; i < existing.length; i += chunk) {
    const batch = writeBatch(db());
    existing.slice(i, i + chunk).forEach((row) => batch.delete(row.ref));
    await batch.commit();
  }
  for (let i = 0; i < rows.length; i += chunk) {
    const batch = writeBatch(db());
    rows.slice(i, i + chunk).forEach((row) => {
      const id = String(row.id);
      batch.set(item(name, id), row);
    });
    await batch.commit();
  }
}

export async function closeDb() {
  activeId = null;
}

export async function initDb(file = "finance.db") {
  activeId = file.startsWith("finance-") ? file.slice("finance-".length).replace(/\.db$/, "") : file;
  await seedIfNeeded(file === "finance.db");
  await seedCategories();
}

async function seedCategories() {
  await withCategoryLock(async () => {
    const groups = await getDocs(col("cashflow_groups"));
    if (groups.size > 0) {
      const items = await getDocs(col("cashflow_items"));
      if (items.size === 0) {
        for (const group of DEFAULT_CATEGORY_GROUPS) {
          for (const [itemIndex, itemRow] of group.items.entries()) {
            await setDoc(item("cashflow_items", itemRow.id), {
              id: itemRow.id,
              group_id: group.id,
              name: itemRow.name,
              sort_order: itemIndex,
            });
          }
        }
      }
      return;
    }
    for (const [groupIndex, group] of DEFAULT_CATEGORY_GROUPS.entries()) {
      await setDoc(item("cashflow_groups", group.id), {
        id: group.id,
        name: group.name,
        kind: group.kind,
        icon: group.icon,
        color: group.color,
        saved: 1,
        sort_order: groupIndex,
      });
      for (const [itemIndex, itemRow] of group.items.entries()) {
        await setDoc(item("cashflow_items", itemRow.id), {
          id: itemRow.id,
          group_id: group.id,
          name: itemRow.name,
          sort_order: itemIndex,
        });
      }
    }
  });
}

async function seedIfNeeded(seedDemoStock: boolean) {
  if (seedDemoStock) {
    const stocks = await getDocs(query(col("cards"), where("kind", "==", "stock")));
    if (stocks.size === 0) {
      const stock = INITIAL_STOCKS[0];
      if (stock) {
        await upsertCard("stock", { ...stock, saved: true });
        await saveStockHistory(stock.id, INITIAL_HISTORY);
      }
    }
  }
  const cash = await getDocs(query(col("cards"), where("kind", "==", "cashflow")));
  if (cash.size > 0) return;
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
  const snap = await getDocs(query(col("cards"), where("kind", "==", kind)));
  return snap.docs
    .map((row) => {
      const data = row.data();
      return {
        id: row.id,
        ticker: String(data.ticker ?? ""),
        name: String(data.name ?? ""),
        image: data.image ? String(data.image) : null,
        letter: data.letter ? String(data.letter) : undefined,
        color: data.color ? String(data.color) : undefined,
        saved: true,
        created_at: Number(data.created_at ?? 0),
      };
    })
    .sort((a, b) => a.created_at - b.created_at)
    .map(({ created_at: _created, ...card }) => card);
}

export async function upsertCard(kind: CardKind, card: ListedStock) {
  const current = await getDoc(item("cards", card.id));
  await setDoc(item("cards", card.id), {
    id: card.id,
    kind,
    ticker: card.ticker,
    name: card.name,
    image: card.image ?? null,
    letter: card.letter ?? null,
    color: card.color ?? null,
    created_at: current.data()?.created_at ?? Date.now(),
  });
}

export async function deleteCard(id: string) {
  const snap = await getDoc(item("cards", id));
  await deleteStoredImage(snap.data()?.image);
  await deleteDoc(item("cards", id));
}

export async function loadStockHistory(cardId: string) {
  const snap = await getDocs(query(col("stock_history"), where("card_id", "==", cardId)));
  return snap.docs
    .map((row) => {
      const data = row.data();
      return {
        id: row.id,
        date: String(data.date ?? ""),
        amount: String(data.amount ?? ""),
        price: String(data.price ?? ""),
        fx: String(data.fx ?? ""),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function saveStockHistory(
  cardId: string,
  entries: { id: string; date: string; amount: string; price: string; fx: string }[],
) {
  await replaceWhere(
    "stock_history",
    "card_id",
    cardId,
    entries.map((entry) => ({ ...entry, card_id: cardId })),
  );
}

export async function loadTradingMonths(cardId: string): Promise<TradeRow[]> {
  const snap = await getDocs(query(col("trading_months"), where("card_id", "==", cardId)));
  return snap.docs
    .map((row) => {
      const data = row.data();
      return {
        id: row.id,
        month: String(data.month ?? ""),
        gain: String(data.gain ?? ""),
        loss: String(data.loss ?? ""),
        deposit: String(data.deposit ?? ""),
        withdrawal: String(data.withdrawal ?? ""),
      };
    })
    .sort((a, b) => b.month.localeCompare(a.month));
}

export async function saveTradingMonths(cardId: string, entries: TradeRow[]) {
  await replaceWhere(
    "trading_months",
    "card_id",
    cardId,
    entries.map((entry) => ({ ...entry, card_id: cardId })),
  );
}

export async function loadTradingDays(cardId: string): Promise<Record<string, DayEntry>> {
  const snap = await getDocs(query(col("trading_days"), where("card_id", "==", cardId)));
  const map: Record<string, DayEntry> = {};
  snap.docs.forEach((row) => {
    const data = row.data();
    map[String(data.date)] = { gain: String(data.gain ?? ""), loss: String(data.loss ?? "") };
  });
  return map;
}

export async function saveTradingDays(cardId: string, days: Record<string, DayEntry>) {
  const rows = Object.entries(days).map(([date, entry]) => ({
    id: `${cardId}_${date}`,
    card_id: cardId,
    date,
    gain: entry.gain,
    loss: entry.loss,
  }));
  await replaceWhere("trading_days", "card_id", cardId, rows);
}

export async function loadCashflowEntries(cardId: string): Promise<CashflowEntry[]> {
  const snap = await getDocs(query(col("cashflow_entries"), where("card_id", "==", cardId)));
  return snap.docs
    .map((row) => {
      const data = row.data();
      return {
        id: row.id,
        date: String(data.date ?? ""),
        kind: (data.kind === "income" ? "income" : "expense") as CashflowEntry["kind"],
        amount: String(data.amount ?? ""),
        label: String(data.label ?? ""),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function loadCategoryGroups(): Promise<CategoryGroup[]> {
  const groups = await getDocs(col("cashflow_groups"));
  const items = await getDocs(col("cashflow_items"));
  const defaults = new Map(DEFAULT_CATEGORY_GROUPS.map((group) => [group.id, group]));
  return groups.docs
    .map((row) => {
      const data = row.data();
      const preset = defaults.get(row.id);
      return {
        id: row.id,
        name: String(data.name ?? ""),
        kind: (data.kind === "income" ? "income" : "expense") as CategoryGroup["kind"],
        icon: String(data.icon || preset?.icon || "other"),
        color: String(data.color || preset?.color || "#6B7280"),
        saved: Number(data.saved ?? 1) === 1,
        sort_order: Number(data.sort_order ?? 0),
        items: items.docs
          .filter((itemRow) => itemRow.data().group_id === row.id)
          .sort((a, b) => Number(a.data().sort_order ?? 0) - Number(b.data().sort_order ?? 0))
          .map((itemRow) => ({ id: itemRow.id, name: String(itemRow.data().name ?? "") })),
      };
    })
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(({ sort_order: _sort, ...group }) => group);
}

export async function saveCategoryGroups(groups: CategoryGroup[]) {
  await withCategoryLock(async () => {
    const existingGroups = await getDocs(col("cashflow_groups"));
    const existingItems = await getDocs(col("cashflow_items"));
    await Promise.all(existingGroups.docs.map((row) => deleteDoc(row.ref)));
    await Promise.all(existingItems.docs.map((row) => deleteDoc(row.ref)));
    for (const [groupIndex, group] of groups.entries()) {
      await setDoc(item("cashflow_groups", group.id), {
        id: group.id,
        name: group.name ?? "",
        kind: group.kind ?? "expense",
        icon: group.icon ?? "other",
        color: group.color ?? "#6B7280",
        saved: group.saved === false ? 0 : 1,
        sort_order: groupIndex,
      });
      for (const [itemIndex, itemRow] of (group.items ?? []).entries()) {
        await setDoc(item("cashflow_items", itemRow.id), {
          id: itemRow.id,
          group_id: group.id,
          name: itemRow.name ?? "",
          sort_order: itemIndex,
        });
      }
    }
  });
}

export async function saveCashflowEntries(cardId: string, entries: CashflowEntry[]) {
  await replaceWhere(
    "cashflow_entries",
    "card_id",
    cardId,
    entries.map((entry) => ({
      id: entry.id ?? `c${Date.now()}`,
      card_id: cardId,
      date: entry.date ?? "",
      kind: entry.kind ?? "expense",
      amount: entry.amount ?? "",
      label: entry.label ?? "",
    })),
  );
}

export async function getSetting(key: string) {
  const snap = await getDoc(item("settings", key));
  const value = snap.data()?.value;
  return typeof value === "string" ? value : null;
}

export async function setSetting(key: string, value: string) {
  await setDoc(item("settings", key), { key, value });
}

export async function persistLogo(id: string, uri: string, previous?: string | null) {
  const blob = await readAsBlob(uri);
  const jpeg = await compressJpeg(blob);
  const stored = (await uploadLogo(id, jpeg)) || (await dataUrlIfSmall(jpeg)) || (await copyLocal(id, uri));
  if (previous && previous !== stored) await deleteStoredImage(previous);
  if (!stored || stored.startsWith("blob:")) return "";
  return stored;
}

export async function deleteStoredImage(uri?: string | null) {
  if (!uri || !isStorageUrl(uri)) return;
  try {
    await deleteObject(ref(getFirebaseStorage(), uri));
  } catch {
    return;
  }
}

export async function deleteProfileImages(profileId: string) {
  try {
    await wipeFolder(ref(getFirebaseStorage(), `profiles/${profileId}`));
  } catch {
    return;
  }
}

async function wipeFolder(folder: StorageReference) {
  const listed = await listAll(folder);
  await Promise.all(listed.items.map((file) => deleteObject(file)));
  await Promise.all(listed.prefixes.map((child) => wipeFolder(child)));
}

function isStorageUrl(uri: string) {
  return uri.includes("firebasestorage.googleapis.com") || uri.includes("firebasestorage.app");
}

async function uploadLogo(id: string, blob: Blob) {
  if (!activeId) return "";
  try {
    const fileRef = ref(getFirebaseStorage(), `profiles/${activeId}/logos/${id}-${Date.now()}.jpg`);
    await uploadBytes(fileRef, blob, { contentType: "image/jpeg" });
    return await getDownloadURL(fileRef);
  } catch {
    return "";
  }
}

async function dataUrlIfSmall(blob: Blob) {
  if (blob.size > 700_000) return "";
  try {
    return await blobToDataUrl(blob);
  } catch {
    return "";
  }
}

async function copyLocal(id: string, uri: string) {
  if (Platform.OS === "web" || uri.startsWith("blob:") || uri.startsWith("data:")) return "";
  try {
    const folder = new Directory(Paths.document, "logos");
    if (!folder.exists) folder.create();
    const ext = uri.split(".").pop()?.split("?")[0] || "jpg";
    const dest = new File(folder, `${id}.${ext}`);
    if (dest.exists) dest.delete();
    await new File(uri).copy(dest);
    return dest.uri;
  } catch {
    return "";
  }
}

async function readAsBlob(uri: string) {
  const response = await fetch(uri);
  return response.blob();
}

async function compressJpeg(blob: Blob) {
  if (typeof document === "undefined") return blob;
  return new Promise<Blob>((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const max = 256;
      let width = img.width;
      let height = img.height;
      if (width > height && width > max) {
        height = Math.round((height * max) / width);
        width = max;
      } else if (height > max) {
        width = Math.round((width * max) / height);
        height = max;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (next) => {
          URL.revokeObjectURL(url);
          resolve(next ?? blob);
        },
        "image/jpeg",
        0.72,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    img.src = url;
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
