"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import type { User, RoleId, Permission } from "@/types/permissions";
import { getEffectivePermissions, hasPermission as checkPermission, coerceRoleId } from "@/lib/permissions";
import { getFirebaseAuth, getFirestoreDb, isFirebaseConfigured } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { setUserProfileAndGetRole, updateRoleForUid } from "@/lib/firestoreUsers";
import { getFullAdminEmailSet } from "@/lib/full-admin-emails";
import { getAuthBackend, isAuthEnabled } from "@/lib/authConfig";
import { supabase } from "@/lib/supabaseClient";
import { adminSetRoleForUid, ensureSupabaseProfileAndRole } from "@/lib/supabaseProfiles";

const FULL_ADMIN_EMAILS = getFullAdminEmailSet();

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
  /** Gerçek giriş kullanılıyor mu (/giris) */
  isAuthEnabled: boolean;
  /** @deprecated Yerine `isAuthEnabled` kullanın (Supabase ile aynı anlamda) */
  isFirebaseEnabled: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const authEnabled = isAuthEnabled();

  useEffect(() => {
    const backend = getAuthBackend();
    let cancelled = false;

    const markLoaded = () => {
      if (!cancelled) setIsLoaded(true);
    };

    if (backend === "demo") {
      setUserState(DEMO_USER);
      setIsLoaded(true);
      return;
    }

    if (backend === "supabase") {
      const applySession = async (session: Session | null) => {
        try {
          if (!session?.user) {
            setUserState(null);
            return;
          }

          const sbUser = session.user;
          let roleId: RoleId = "member";
          try {
            roleId = await ensureSupabaseProfileAndRole(supabase, sbUser);
          } catch (profErr) {
            console.warn("[Auth] Supabase profil güncellenemedi; üye varsayılanı kullanılacak:", profErr);
            const mail = (sbUser.email ?? "").toLowerCase();
            roleId = FULL_ADMIN_EMAILS.has(mail) ? "admin" : "member";
          }

          roleId = coerceRoleId(roleId);
          const displayFromMeta =
            typeof sbUser.user_metadata?.full_name === "string" ? sbUser.user_metadata.full_name : null;

          setUserState({
            id: sbUser.id,
            email: sbUser.email ?? "",
            displayName: displayFromMeta ?? sbUser.email ?? null,
            roleId,
          });
        } catch (err) {
          console.error("[Auth] Supabase oturum senkronu:", err);
          const su = session?.user;
          if (su) {
            const mail = (su.email ?? "").toLowerCase();
            setUserState({
              id: su.id,
              email: su.email ?? "",
              displayName: su.email ?? null,
              roleId: FULL_ADMIN_EMAILS.has(mail) ? "admin" : "member",
            });
          } else {
            setUserState(null);
          }
        } finally {
          markLoaded();
        }
      };

      supabase.auth.getSession().then(({ data }) => {
        if (cancelled) return;
        void applySession(data.session);
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, sess) => {
        if (cancelled) return;
        void applySession(sess);
      });

      return () => {
        cancelled = true;
        subscription.unsubscribe();
      };
    }

    /** Firebase Auth (yalnızca Supabase yoksa) */
    if (!isFirebaseConfigured()) {
      setIsLoaded(true);
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      setIsLoaded(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (cancelled) return;
      try {
        if (!fbUser) {
          setUserState(null);
          return;
        }

        const email = (fbUser.email ?? "").toLowerCase();
        const isFullAdmin = FULL_ADMIN_EMAILS.has(email);
        let roleId: RoleId = "member";

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
          try {
            const fromFs = await setUserProfileAndGetRole(
              fbUser.uid,
              fbUser.email ?? "",
              fbUser.displayName ?? fbUser.email ?? null
            );
            roleId = coerceRoleId(fromFs);
          } catch (firestoreErr) {
            console.warn(
              "[Auth] Firestore profil güncellenemedi; oturum yine de açılacak (üye varsayılanı)",
              firestoreErr
            );
            roleId = "member";
          }
        }

        setUserState({
          id: fbUser.uid,
          email: fbUser.email ?? "",
          displayName: fbUser.displayName ?? fbUser.email ?? null,
          roleId,
        });
      } catch (err) {
        console.error("[Auth] onAuthStateChanged hatası:", err);
        if (fbUser) {
          setUserState({
            id: fbUser.uid,
            email: fbUser.email ?? "",
            displayName: fbUser.displayName ?? fbUser.email ?? null,
            roleId: FULL_ADMIN_EMAILS.has((fbUser.email ?? "").toLowerCase()) ? "admin" : "member",
          });
        } else {
          setUserState(null);
        }
      } finally {
        markLoaded();
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
  }, []);

  const updateUserRole = useCallback(
    async (roleId: RoleId, targetUid?: string) => {
      const uid = targetUid ?? user?.id;
      if (!uid) return;
      if (targetUid && user?.roleId !== "admin") return;
      try {
        const b = getAuthBackend();
        if (b === "supabase") {
          await adminSetRoleForUid(supabase, uid, roleId);
        } else if (b === "firebase") {
          await updateRoleForUid(uid, roleId);
        }
        if (uid === user?.id) {
          setUserState((prev) => (prev ? { ...prev, roleId } : null));
        }
      } catch (e) {
        console.warn("[Auth] updateUserRole failed:", e);
      }
    },
    [user?.id, user?.roleId]
  );

  const signOut = useCallback(async () => {
    const b = getAuthBackend();
    if (b === "supabase") {
      await supabase.auth.signOut();
      setUserState(null);
      return;
    }
    if (b === "firebase") {
      const auth = getFirebaseAuth();
      if (auth) await auth.signOut();
      setUserState(null);
      return;
    }
    setUserState(DEMO_USER);
  }, []);

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
    isAuthEnabled: authEnabled,
    isFirebaseEnabled: authEnabled,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
