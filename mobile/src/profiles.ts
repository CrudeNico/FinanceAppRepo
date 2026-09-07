import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { closeDb, getSetting, initDb, persistLogo, setSetting } from "./db";
import { getFirestoreDb } from "./firebase";

export type UserProfile = {
  id: string;
  name: string;
  avatar: string | null;
  file: string;
};

let active: UserProfile | null = null;

function metaRef() {
  return doc(getFirestoreDb(), "app", "meta");
}

export function getActiveProfile() {
  return active;
}

export async function initProfiles() {
  await getFirestoreDb();
}

export async function getLastTheme() {
  const snap = await getDoc(metaRef());
  return snap.data()?.lastTheme === "dark" ? "dark" : "light";
}

export async function setLastTheme(mode: "light" | "dark") {
  await setDoc(metaRef(), { lastTheme: mode }, { merge: true });
}

export async function listProfiles(): Promise<UserProfile[]> {
  const snap = await getDocs(collection(getFirestoreDb(), "profiles"));
  return snap.docs
    .map((item) => {
      const data = item.data();
      return {
        id: item.id,
        name: String(data.name ?? "Profile"),
        avatar: data.avatar ? String(data.avatar) : null,
        file: String(data.file ?? `finance-${item.id}.db`),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function getSession() {
  const snap = await getDoc(metaRef());
  const value = snap.data()?.current;
  return typeof value === "string" && value ? value : null;
}

async function setSession(id: string | null) {
  await setDoc(metaRef(), { current: id }, { merge: true });
}

export async function enterProfile(id: string) {
  const profiles = await listProfiles();
  let profile = profiles.find((item) => item.id === id);
  if (!profile) return null;
  await initDb(id);
  const stored = await getSetting("avatar");
  if (stored && !profile.avatar) {
    await updateProfileAvatar(id, stored);
    profile = { ...profile, avatar: stored };
  } else if (profile.avatar && !stored) {
    await setSetting("avatar", profile.avatar);
  }
  const theme = await getSetting("theme");
  if (theme === "dark" || theme === "light") await setLastTheme(theme);
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
  const id = `p${Date.now()}`;
  await setDoc(doc(getFirestoreDb(), "profiles", id), {
    name: name.trim() || "Profile",
    avatar: null,
    file: `finance-${id}.db`,
    password,
    created_at: Date.now(),
  });
  return id;
}

export async function checkProfilePassword(id: string, password: string) {
  const snap = await getDoc(doc(getFirestoreDb(), "profiles", id));
  const stored = snap.data()?.password;
  return Boolean(stored) && stored === password;
}

export async function deleteProfile(id: string, password: string) {
  if (!(await checkProfilePassword(id, password))) return false;
  const db = getFirestoreDb();
  const profileRef = doc(db, "profiles", id);
  const collections = [
    "cards",
    "stock_history",
    "trading_months",
    "trading_days",
    "cashflow_entries",
    "cashflow_groups",
    "cashflow_items",
    "settings",
  ];
  for (const name of collections) {
    const rows = await getDocs(collection(profileRef, name));
    await Promise.all(rows.docs.map((item) => deleteDoc(item.ref)));
  }
  await deleteDoc(profileRef);
  const session = await getSession();
  if (session === id) await setSession(null);
  return true;
}

export async function updateProfileAvatar(id: string, uri: string | null) {
  await setDoc(doc(getFirestoreDb(), "profiles", id), { avatar: uri }, { merge: true });
  if (active?.id === id) active = { ...active, avatar: uri };
}

export async function saveProfilePhoto(id: string, uri: string) {
  const stored = await persistLogo(`avatar-${id}`, uri);
  await updateProfileAvatar(id, stored);
  return stored;
}
