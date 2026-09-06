import * as SQLite from "expo-sqlite";
import { closeDb, getSetting, initDb, persistLogo, setSetting } from "./db";

export type UserProfile = {
  id: string;
  name: string;
  avatar: string | null;
  file: string;
};

let meta: SQLite.SQLiteDatabase | null = null;
let active: UserProfile | null = null;

async function getMeta() {
  if (meta) return meta;
  const database = await SQLite.openDatabaseAsync("profiles.db");
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      avatar TEXT,
      file TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS session (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
  const cols = await database.getAllAsync<{ name: string }>("PRAGMA table_info(profiles)");
  if (!cols.some((col) => col.name === "password")) {
    await database.execAsync("ALTER TABLE profiles ADD COLUMN password TEXT NOT NULL DEFAULT ''");
  }
  meta = database;
  return database;
}

export function getActiveProfile() {
  return active;
}

export async function initProfiles() {
  const database = await getMeta();
  const wiped = await getMetaValue("starterCleared");
  if (!wiped) {
    for (const profile of await listProfiles()) {
      await database.runAsync("DELETE FROM profiles WHERE id = ?", profile.id);
      await SQLite.deleteDatabaseAsync(profile.file).catch(() => undefined);
    }
    await SQLite.deleteDatabaseAsync("finance.db").catch(() => undefined);
    await setSession(null);
    await setMetaValue("starterCleared", "1");
  }
}

async function getMetaValue(key: string) {
  const database = await getMeta();
  const row = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM session WHERE key = ?",
    key,
  );
  return row?.value ?? null;
}

async function setMetaValue(key: string, value: string) {
  const database = await getMeta();
  await database.runAsync(
    "INSERT INTO session (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    value,
  );
}

export async function getLastTheme() {
  const value = await getMetaValue("lastTheme");
  return value === "dark" ? "dark" : "light";
}

export async function setLastTheme(mode: "light" | "dark") {
  await setMetaValue("lastTheme", mode);
}

export async function listProfiles(): Promise<UserProfile[]> {
  const database = await getMeta();
  const rows = await database.getAllAsync<{
    id: string;
    name: string;
    avatar: string | null;
    file: string;
  }>("SELECT id, name, avatar, file FROM profiles ORDER BY created_at ASC");
  return rows;
}

export async function getSession() {
  const database = await getMeta();
  const row = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM session WHERE key = ?",
    "current",
  );
  return row?.value ?? null;
}

async function setSession(id: string | null) {
  const database = await getMeta();
  if (!id) {
    await database.runAsync("DELETE FROM session WHERE key = ?", "current");
    return;
  }
  await database.runAsync(
    "INSERT INTO session (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    "current",
    id,
  );
}

export async function enterProfile(id: string) {
  const profiles = await listProfiles();
  const profile = profiles.find((item) => item.id === id);
  if (!profile) return null;
  await initDb(profile.file);
  const stored = await getSetting("avatar");
  if (stored && !profile.avatar) {
    await updateProfileAvatar(id, stored);
    profile = { ...profile, avatar: stored };
  } else if (profile.avatar && !stored) {
    await setSetting("avatar", profile.avatar);
  }
  const theme = await getSetting("theme");
  await setLastTheme(theme === "dark" ? "dark" : "light");
  await setSession(id);
  active = profile;
  return profile;
}

export async function logoutProfile() {
  await setSession(null);
  active = null;
  await closeDb();
}

export async function addProfile(name: string, password: string) {
  const database = await getMeta();
  const id = `p${Date.now()}`;
  const file = `finance-${id}.db`;
  await database.runAsync(
    "INSERT INTO profiles (id, name, avatar, file, password, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    id,
    name.trim() || "Profile",
    null,
    file,
    password,
    Date.now(),
  );
  return id;
}

export async function checkProfilePassword(id: string, password: string) {
  const database = await getMeta();
  const row = await database.getFirstAsync<{ password: string }>(
    "SELECT password FROM profiles WHERE id = ?",
    id,
  );
  return Boolean(row?.password) && row?.password === password;
}

export async function deleteProfile(id: string, password: string) {
  if (!(await checkProfilePassword(id, password))) return false;
  const database = await getMeta();
  const row = await database.getFirstAsync<{ file: string }>(
    "SELECT file FROM profiles WHERE id = ?",
    id,
  );
  await database.runAsync("DELETE FROM profiles WHERE id = ?", id);
  if (row?.file && row.file !== "finance.db") {
    await SQLite.deleteDatabaseAsync(row.file).catch(() => undefined);
  } else if (row?.file === "finance.db") {
    await SQLite.deleteDatabaseAsync("finance.db").catch(() => undefined);
  }
  return true;
}

export async function updateProfileAvatar(id: string, uri: string | null) {
  const database = await getMeta();
  await database.runAsync("UPDATE profiles SET avatar = ? WHERE id = ?", uri, id);
  if (active?.id === id) active = { ...active, avatar: uri };
}

export async function saveProfilePhoto(id: string, uri: string) {
  const stored = await persistLogo(`avatar-${id}`, uri);
  await updateProfileAvatar(id, stored);
  return stored;
}
