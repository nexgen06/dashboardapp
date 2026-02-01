/**
 * Firestore üzerinde kullanıcı profilleri ve roller.
 * Koleksiyon: users (doc id = Firebase Auth uid)
 * Alanlar: email, displayName, roleId, updatedAt
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { getFirestoreDb, isFirebaseConfigured } from "./firebase";
import type { RoleId } from "@/types/permissions";
import { ROLES } from "@/types/permissions";

const COLLECTION = "users";

export type FirestoreUserProfile = {
  uid: string;
  email: string;
  displayName: string | null;
  roleId: RoleId;
  updatedAt?: string | null;
};

function mapDocToProfile(uid: string, data: Record<string, unknown>): FirestoreUserProfile {
  const roleId = (data.roleId as RoleId) && ROLES[data.roleId as RoleId] ? (data.roleId as RoleId) : "member";
  return {
    uid,
    email: String(data.email ?? ""),
    displayName: data.displayName != null ? String(data.displayName) : null,
    roleId,
    updatedAt: data.updatedAt != null ? String(data.updatedAt) : null,
  };
}

/** Kullanıcının rolünü Firestore'dan oku (yoksa "member") */
export async function getRoleForUid(uid: string): Promise<RoleId> {
  if (!isFirebaseConfigured()) return "member";
  const db = getFirestoreDb();
  if (!db) return "member";
  try {
    const snap = await getDoc(doc(db, COLLECTION, uid));
    const data = snap.data();
    if (data?.roleId && ROLES[data.roleId as RoleId]) return data.roleId as RoleId;
  } catch (e) {
    console.warn("[firestoreUsers] getRoleForUid failed:", e);
  }
  return "member";
}

/** Giriş sonrası profil bilgisini Firestore'a yaz (merge); rolü döndür. Hata durumunda bir kez daha dener. */
export async function setUserProfileAndGetRole(uid: string, email: string, displayName: string | null): Promise<RoleId> {
  const db = getFirestoreDb();
  if (!db) return "member";
  const ref = doc(db, COLLECTION, uid);
  let roleId: RoleId = "member";
  try {
    const snap = await getDoc(ref);
    const existing = snap.data();
    roleId = existing?.roleId && ROLES[existing.roleId as RoleId] ? (existing.roleId as RoleId) : "member";
  } catch (e) {
    console.warn("[firestoreUsers] setUserProfileAndGetRole getDoc failed:", e);
  }
  const payload = {
    email: email || "",
    displayName: displayName ?? null,
    roleId,
    updatedAt: serverTimestamp(),
  };
  const doWrite = () => setDoc(ref, payload, { merge: true });
  try {
    await doWrite();
    return roleId;
  } catch (e) {
    console.warn("[firestoreUsers] setUserProfileAndGetRole setDoc failed (will retry once):", e);
    try {
      await doWrite();
      return roleId;
    } catch (e2) {
      console.warn("[firestoreUsers] setUserProfileAndGetRole setDoc retry failed:", e2);
      return "member";
    }
  }
}

/** Belirli bir kullanıcının rolünü güncelle (yönetici veya kendi rolü) */
export async function updateRoleForUid(uid: string, roleId: RoleId): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error("Firestore yok");
  await updateDoc(doc(db, COLLECTION, uid), { roleId, updatedAt: serverTimestamp() });
}

/** Tüm kullanıcıları listele (yönetici sayfası için). orderBy kullanmıyoruz ki indeks zorunlu olmasın ve updatedAt olmayan belgeler de listelensin. */
export async function listUsers(): Promise<FirestoreUserProfile[]> {
  const db = getFirestoreDb();
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, COLLECTION));
    const list = snap.docs.map((d) => mapDocToProfile(d.id, d.data() as Record<string, unknown>));
    list.sort((a, b) => {
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tb - ta;
    });
    return list;
  } catch (e) {
    console.warn("[firestoreUsers] listUsers failed:", e);
    return [];
  }
}
