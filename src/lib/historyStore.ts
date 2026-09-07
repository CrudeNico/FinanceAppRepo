import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";

export type HistoryEntry = {
  id: string;
  date: string;
  amount: string;
  price: string;
  fx: string;
};

const COLLECTION = "history";

export async function loadHistory(): Promise<HistoryEntry[]> {
  const snap = await getDocs(collection(getFirestoreDb(), COLLECTION));
  return snap.docs.map((item) => item.data() as HistoryEntry);
}

export async function saveHistory(entries: HistoryEntry[]) {
  const db = getFirestoreDb();
  const snap = await getDocs(collection(db, COLLECTION));
  const keep = new Set(entries.map((entry) => entry.id));
  await Promise.all(
    snap.docs
      .filter((item) => !keep.has(item.id))
      .map((item) => deleteDoc(item.ref)),
  );
  await Promise.all(entries.map((entry) => setDoc(doc(db, COLLECTION, entry.id), entry)));
}
