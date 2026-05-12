"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import type { User, RoleId, Permission } from "@/types/permissions";
import { getEffectivePermissions, hasPermission as checkPermission, coerceRoleId } from "@/lib/permissions";
import { getFullAdminEmailSet } from "@/lib/full-admin-emails";
import { getAuthBackend, isAuthEnabled } from "@/lib/authConfig";
import { supabase } from "@/lib/supabaseClient";
import { adminSetRoleForUid, ensureSupabaseProfileAndRole } from "@/lib/supabaseProfiles";
import { resolveAuthDisplayName } from "@/lib/userDisplayName";

const FULL_ADMIN_EMAILS = getFullAdminEmailSet();

/** Supabase yapılandırması yokken kullanılan sabit demo kullanıcı */
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
  hasPermission: (permission: Permission) => boolean;
  permissions: Permission[];
  isAdmin: boolean;
  isAuthEnabled: boolean;
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

    const applySession = async (session: Session | null) => {
      try {
        if (!session?.user) {
          setUserState(null);
          return;
        }

        const sbUser = session.user;
        let roleId: RoleId = "member";
        let profileDisplayName: string | null = null;
        try {
          const ensured = await ensureSupabaseProfileAndRole(supabase, sbUser);
          roleId = ensured.roleId;
          profileDisplayName = ensured.profileDisplayName;
        } catch (profErr) {
          console.warn("[Auth] Supabase profil güncellenemedi; üye varsayılanı kullanılacak:", profErr);
          const mail = (sbUser.email ?? "").toLowerCase();
          roleId = FULL_ADMIN_EMAILS.has(mail) ? "admin" : "member";
        }

        roleId = coerceRoleId(roleId);

        setUserState({
          id: sbUser.id,
          email: sbUser.email ?? "",
          displayName: resolveAuthDisplayName(sbUser, profileDisplayName),
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
            displayName: resolveAuthDisplayName(su, null),
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
        if (getAuthBackend() !== "supabase") return;
        await adminSetRoleForUid(supabase, uid, roleId);
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
    if (getAuthBackend() === "supabase") {
      await supabase.auth.signOut();
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
