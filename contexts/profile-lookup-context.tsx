"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { listAllProfiles, type UserProfile } from "@/lib/profile";

/**
 * Tüm profilleri tek seferde çekip bellekte tutar; email veya user_id ile lookup
 * sağlar. Avatar / nickname göstermek isteyen her bileşen `useProfileLookup`
 * kullanır.
 *
 * Realtime senkronu YOK — profiller seyrek değişir; gerekirse `refresh()`
 * çağrılır.
 */

type LookupResult = {
  avatarUrl: string | null;
  nickname: string | null;
  fullName: string | null;
  email: string;
  /** Tam profil (varsa); yoksa null = tablo dışı kullanıcı (sadece atama metni) */
  profile: UserProfile | null;
};

type ProfileLookupApi = {
  byEmail: (email: string | null | undefined) => LookupResult;
  byUserId: (userId: string | null | undefined) => LookupResult;
  /** Bellekteki tüm profilleri döner — autocomplete (@mention) gibi senaryolar için. */
  listAll: () => UserProfile[];
  refresh: () => Promise<void>;
  isLoading: boolean;
};

const Ctx = createContext<ProfileLookupApi | null>(null);

const EMPTY_RESULT: LookupResult = {
  avatarUrl: null,
  nickname: null,
  fullName: null,
  email: "",
  profile: null,
};

export function ProfileLookupProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useAuth();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const all = await listAllProfiles();
      setProfiles(all);
    } catch {
      // Sessizce başarısız — avatar lookup'lar fallback'e düşer
      setProfiles([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      setProfiles([]);
      setIsLoading(false);
      return;
    }
    void refresh();
  }, [isLoaded, user, refresh]);

  const { byEmailMap, byIdMap } = useMemo(() => {
    const byEmail = new Map<string, UserProfile>();
    const byId = new Map<string, UserProfile>();
    for (const p of profiles) {
      if (p.email) byEmail.set(p.email.trim().toLowerCase(), p);
      if (p.id) byId.set(p.id, p);
    }
    return { byEmailMap: byEmail, byIdMap: byId };
  }, [profiles]);

  const api = useMemo<ProfileLookupApi>(() => {
    const toResult = (p: UserProfile | undefined, fallbackEmail = ""): LookupResult => {
      if (!p) {
        return { ...EMPTY_RESULT, email: fallbackEmail };
      }
      return {
        avatarUrl: p.avatar_url ?? null,
        nickname: p.nickname ?? p.display_name ?? null,
        fullName: p.full_name ?? null,
        email: p.email,
        profile: p,
      };
    };
    return {
      byEmail: (email) => {
        if (!email) return EMPTY_RESULT;
        const key = email.trim().toLowerCase();
        return toResult(byEmailMap.get(key), key);
      },
      byUserId: (userId) => {
        if (!userId) return EMPTY_RESULT;
        return toResult(byIdMap.get(userId));
      },
      listAll: () => profiles,
      refresh,
      isLoading,
    };
  }, [byEmailMap, byIdMap, profiles, refresh, isLoading]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useProfileLookup(): ProfileLookupApi {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useProfileLookup yalnızca <ProfileLookupProvider> içinde kullanılabilir");
  }
  return ctx;
}
