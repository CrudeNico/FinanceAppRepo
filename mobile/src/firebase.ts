import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAGv1DGeOAFlTm2t0AI1MJmQ6XpCcZPavs",
  authDomain: "networthapp-f6dfc.firebaseapp.com",
  projectId: "networthapp-f6dfc",
  storageBucket: "networthapp-f6dfc.firebasestorage.app",
  messagingSenderId: "17133140591",
  appId: "1:17133140591:web:872c6ddba26ed527b22b9a",
  measurementId: "G-2ETTBBGKNK",
};

function getApp() {
  return getApps()[0] ?? initializeApp(firebaseConfig);
}

export function getFirestoreDb() {
  return getFirestore(getApp());
}

export function getFirebaseStorage() {
  return getStorage(getApp());
}
