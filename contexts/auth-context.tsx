"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { User, RoleId, Permission } from "@/types/permissions";
import { ROLES } from "@/types/permissions";
import { getEffectivePermissions, hasPermission as checkPermission } from "@/lib/permissions";
import { getFirebaseAuth, getFirestoreDb, isFirebaseConfigured } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged, type User as FirebaseAuthUser } from "firebase/auth";
import { setUserProfileAndGetRole, updateRoleForUid } from "@/lib/firestoreUsers";

/** Tam yetkili (admin) e-posta — bu kullanıcı her zaman admin sayılır */
const ADMIN_EMAIL = "ugurgrses@gmail.com";

/** Firebase kapalıyken kullanılan sabit demo kullanıcı */
const DEMO_USER: User = {
  id: "demo",
  email: "demo@local",
  displayName: "Demo kullanıcı",
  roleId: "member",
};

type AuthContextType = {
  user: User | null;
  isLoaded: boolean;
  setUser: (user: User | null) => void;
  /** Mevcut kullanıcının veya (admin ise) hedef kullanıcının rolünü günceller. targetUid verilirse sadece admin kullanabilir. */
  updateUserRole: (roleId: RoleId, targetUid?: string) => void;
  signOut: () => void;
  /** Yetki kontrolü */
  hasPermission: (permission: Permission) => boolean;
  permissions: Permission[];
  isAdmin: boolean;
  /** Firebase Auth kullanılıyor mu (giriş sayfası gösterimi için) */
  isFirebaseEnabled: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const isFirebaseEnabled = isFirebaseConfigured();

  useEffect(() => {
    if (isFirebaseEnabled) {
      const auth = getFirebaseAuth();
      if (!auth) {
        setIsLoaded(true);
        return;
      }
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          const email = (fbUser.email ?? "").toLowerCase();
          const isFullAdmin = email === ADMIN_EMAIL;
          let roleId: RoleId;
          if (isFullAdmin) {
            roleId = "admin";
            const db = getFirestoreDb();
            if (db) {
              setDoc(
                doc(db, "users", fbUser.uid),
                {
                  email: fbUser.email ?? "",
                  displayName: fbUser.displayName ?? fbUser.email ?? null,
                  roleId: "admin",
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              ).catch(() => {});
            }
          } else {
            roleId = await setUserProfileAndGetRole(
              fbUser.uid,
              fbUser.email ?? "",
              fbUser.displayName ?? fbUser.email ?? null
            );
          }
          setUserState({
            id: fbUser.uid,
            email: fbUser.email ?? "",
            displayName: fbUser.displayName ?? fbUser.email ?? null,
            roleId,
          });
        } else {
          setUserState(null);
        }
        setIsLoaded(true);
      });
      return () => unsubscribe();
    } else {
      setUserState(DEMO_USER);
      setIsLoaded(true);
    }
  }, [isFirebaseEnabled]);

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
  }, []);

  const updateUserRole = useCallback(
    async (roleId: RoleId, targetUid?: string) => {
      const uid = targetUid ?? user?.id;
      if (!uid) return;
      if (targetUid && user?.roleId !== "admin") return;
      try {
        await updateRoleForUid(uid, roleId);
        if (uid === user?.id) {
          setUserState((prev) => (prev ? { ...prev, roleId } : null));
        }
      } catch (e) {
        console.warn("[Auth] updateUserRole failed:", e);
      }
    },
    [isFirebaseEnabled, user?.id, user?.roleId]
  );

  const signOut = useCallback(() => {
    if (isFirebaseEnabled) {
      const auth = getFirebaseAuth();
      if (auth) auth.signOut();
    }
    setUserState(isFirebaseEnabled ? null : DEMO_USER);
  }, [isFirebaseEnabled]);

  const permissions = React.useMemo(() => getEffectivePermissions(user), [user]);
  const hasPermission = useCallback(
    (permission: Permission) => checkPermission(user, permission),
    [user]
  );
  const isAdmin = user?.roleId === "admin";

  const value: AuthContextType = {
    user,
    isLoaded,
    setUser,
    updateUserRole,
    signOut,
    hasPermission,
    permissions,
    isAdmin,
    isFirebaseEnabled,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
