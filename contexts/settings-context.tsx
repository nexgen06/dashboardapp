"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { hasPermission as userHasPermission } from "@/lib/permissions";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  SETTINGS_FALLBACK_POLL_MS,
  isRealtimeDisabledForClient,
  shouldPollInBrowser,
} from "@/lib/realtimeFallback";
import {
  fetchLiveTableDensityFromServer,
  fetchPiiPolicyModeFromServer,
  fetchPiiSensitiveDisplayModeFromServer,
  persistLiveTableDensityToServer,
  persistPiiPolicyModeToServer,
  persistPiiSensitiveDisplayModeToServer,
  LIVE_TABLE_DENSITY_APP_SETTINGS_KEY,
  PII_POLICY_MODE_APP_SETTINGS_KEY,
  PII_SENSITIVE_DISPLAY_MODE_APP_SETTINGS_KEY,
} from "@/lib/appSettingsSupabase";

const STORAGE_KEY = "dashboard-settings";
const SAVE_DEBOUNCE_MS = 800;

export type Theme = "light" | "dark" | "system";
/** Vurgu (accent) rengi — primary butonlar, focus ring, vurgular bu renge bağlı. */
export type AccentColor = "blue" | "green" | "purple" | "orange" | "red";
export const ACCENT_COLORS: ReadonlyArray<{ value: AccentColor; label: string; preview: string }> = [
  { value: "blue", label: "Mavi", preview: "hsl(221 83% 53%)" },
  { value: "green", label: "Yeşil", preview: "hsl(142 71% 45%)" },
  { value: "purple", label: "Mor", preview: "hsl(262 83% 58%)" },
  { value: "orange", label: "Turuncu", preview: "hsl(25 95% 53%)" },
  { value: "red", label: "Kırmızı", preview: "hsl(0 72% 51%)" },
];
export type Language = "tr" | "en";
export type DateFormat = "DD.MM.YYYY" | "YYYY-MM-DD" | "MM/DD/YYYY";
export type LogLevel = "error" | "warn" | "info" | "debug";
/** Canlı Tablo satır / yazı yoğunluğu */
export type LiveTableDensity = "compact" | "normal" | "comfortable";
/** Canlı Tablo görünüm şablonu */
export type LiveTableTemplate = "classic" | "modern";
export type PiiPolicyMode = "shadow" | "enforce";
export type PiiSensitiveDisplayMode = "hidden_copy" | "masked_copy";

const DEFAULT_STATUS_LIST = "Yapılacak, Devam, Tamamlandı";
const DEFAULT_PRIORITY_LIST = "High, Medium, Low";

export type Settings = {
  theme: Theme;
  /** Vurgu (accent) rengi — primary butonlar, focus ring, link rengi. */
  accentColor: AccentColor;
  /**
   * Kurumsal marka rengi (HEX, "#1d4ed8"). Boş/null ise `accentColor` preset'i
   * kullanılır; dolu ise tüm --accent-* tonları bu HEX'ten üretilip
   * preset'i override eder. (D2 — Brand Color Customization)
   */
  brandColor: string | null;
  /**
   * Kurumsal logo (data URL — küçük dosyalar için yeterli). Sidebar başlığında
   * "Panel" metni yerine gösterilir. Maksimum boyut UI'da 200KB ile sınırlı.
   */
  brandLogoDataUrl: string | null;
  language: Language;
  dateFormat: DateFormat;
  sidebarCollapsedByDefault: boolean;
  notificationsEmail: boolean;
  notificationsPush: boolean;
  notificationsSound: boolean;
  debugMode: boolean;
  logLevel: LogLevel;
  experimentalFeatures: boolean;
  /** Virgül veya satırla ayrılmış durum listesi. Boşsa varsayılan kullanılır. */
  customStatusList: string;
  /** Virgül veya satırla ayrılmış öncelik listesi. Boşsa varsayılan kullanılır. */
  customPriorityList: string;
  /** Yeni görevde varsayılan durum (listede olmalı). */
  defaultTaskStatus: string;
  /** Yeni görevde varsayılan öncelik (listede olmalı). */
  defaultTaskPriority: string;
  /** Canlı Tablo görünüm yoğunluğu (satır aralığı, yazı boyutu). */
  liveTableDensity: LiveTableDensity;
  /** Canlı Tablo görsel şablonu (hücre yapısı değişmez). */
  liveTableTemplate: LiveTableTemplate;
  /**
   * Görev özeti / Acil görevler satır başlığı: `content` boşsa `extra_data` içinde bu anahtarlar sırayla aranır.
   * Virgül veya satır ile ayırın. Boşsa varsayılan sabit liste kullanılır.
   */
  taskSummaryPreferredExtraKeys: string;
  /**
   * Acil görevlerde “yüksek öncelik” sayılacak `task.priority` değerleri (küçük/büyük harf duyarsız).
   * Virgül veya satır ile ayırın. Boşsa high, yüksek, kritik, p1, acil, urgent kullanılır.
   */
  urgentPriorityTokens: string;
  /**
   * TCKN/Sicil gibi hassas alanlar için bir kullanıcının saatlik kopyalama limiti.
   * 0 = limit yok. Bu eşik aşılırsa kopya işlemi engellenir + admin'e alarm.
   */
  piiCopyHourlyLimit: number;
  /** Hassas policy karar modu: shadow (sadece log) / enforce (deny uygula). */
  piiPolicyMode: PiiPolicyMode;
  /** Hassas hücre görünümü: tam gizli etiket veya maskeli değer + kopya. */
  piiSensitiveDisplayMode: PiiSensitiveDisplayMode;
};

const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  accentColor: "blue",
  brandColor: null,
  brandLogoDataUrl: null,
  language: "tr",
  dateFormat: "DD.MM.YYYY",
  sidebarCollapsedByDefault: false,
  notificationsEmail: true,
  notificationsPush: false,
  notificationsSound: true,
  debugMode: false,
  logLevel: "info",
  experimentalFeatures: false,
  customStatusList: "",
  customPriorityList: "",
  defaultTaskStatus: "Yapılacak",
  defaultTaskPriority: "Medium",
  liveTableDensity: "normal",
  liveTableTemplate: "classic",
  taskSummaryPreferredExtraKeys: "",
  urgentPriorityTokens: "",
  piiCopyHourlyLimit: 50,
  piiPolicyMode: "shadow",
  piiSensitiveDisplayMode: "hidden_copy",
};

function coerceLiveTableDensity(v: unknown): LiveTableDensity {
  if (v === "compact" || v === "normal" || v === "comfortable") return v;
  return "normal";
}

function coerceLiveTableTemplate(v: unknown): LiveTableTemplate {
  if (v === "classic" || v === "modern") return v;
  return "classic";
}

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      liveTableDensity: coerceLiveTableDensity(parsed.liveTableDensity),
      liveTableTemplate: coerceLiveTableTemplate(parsed.liveTableTemplate),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: Settings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn("[Settings] localStorage save failed", e);
  }
}

export type SettingsSection = "genel" | "gorunum" | "bildirimler" | "gorevler" | "gelismis";

/** Virgül veya satırla ayrılmış metni trim'lenmiş diziye çevirir. */
export function parseListOptionString(value: string | undefined): string[] {
  if (!value || !String(value).trim()) return [];
  return String(value)
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Ayarlardan görev durum listesini döner. Boşsa varsayılan listeyi kullanır. */
export function getStatusOptions(settings: Settings): string[] {
  const custom = parseListOptionString(settings.customStatusList);
  if (custom.length > 0) return custom;
  return DEFAULT_STATUS_LIST.split(",").map((s) => s.trim());
}

/** Ayarlardan görev öncelik listesini döner. Boşsa varsayılan listeyi kullanır. */
export function getPriorityOptions(settings: Settings): string[] {
  const custom = parseListOptionString(settings.customPriorityList);
  if (custom.length > 0) return custom;
  return DEFAULT_PRIORITY_LIST.split(",").map((s) => s.trim());
}

type SettingsContextType = {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetToDefaults: () => void;
  resetSection: (section: SettingsSection) => void;
  isDirty: boolean;
  save: () => void;
  lastSavedAt: number | null;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const SECTION_KEYS: Record<SettingsSection, (keyof Settings)[]> = {
  genel: ["language", "dateFormat"],
  gorunum: ["theme", "accentColor", "brandColor", "brandLogoDataUrl", "sidebarCollapsedByDefault", "liveTableDensity", "liveTableTemplate"],
  bildirimler: ["notificationsEmail", "notificationsPush", "notificationsSound"],
  gorevler: [
    "customStatusList",
    "customPriorityList",
    "defaultTaskStatus",
    "defaultTaskPriority",
    "taskSummaryPreferredExtraKeys",
    "urgentPriorityTokens",
  ],
  gelismis: ["debugMode", "logLevel", "experimentalFeatures"],
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded: authLoaded } = useAuth();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [initialSettings, setInitialSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [mounted, setMounted] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userHasChangedRef = useRef(false);
  /** İlk sunucu çekiminden önce kullanıcı yoğunluğu elle değiştirdiyse sunucu yanıtı ezmesin. */
  const liveTableDensityEditedLocallyRef = useRef(false);
  const densityPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const piiPolicyModePersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const piiSensitiveDisplayModePersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    setInitialSettings(loaded);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !authLoaded) return;
    const skipServer =
      !isSupabaseConfigured() || !user || user.id === "demo";
    if (skipServer) return;

    let cancelled = false;

    void (async () => {
      const d = await fetchLiveTableDensityFromServer();
      if (cancelled || !d) return;
      if (!liveTableDensityEditedLocallyRef.current) {
        setSettings((prev) => ({ ...prev, liveTableDensity: d }));
      }
    })();

    const filterKey = LIVE_TABLE_DENSITY_APP_SETTINGS_KEY;
    if (isRealtimeDisabledForClient()) {
      const interval = window.setInterval(async () => {
        if (!shouldPollInBrowser()) return;
        const d = await fetchLiveTableDensityFromServer();
        if (cancelled || !d || liveTableDensityEditedLocallyRef.current) return;
        setSettings((prev) => ({ ...prev, liveTableDensity: d }));
      }, SETTINGS_FALLBACK_POLL_MS);
      return () => {
        cancelled = true;
        window.clearInterval(interval);
      };
    }

    const channel = supabase
      .channel(`app_settings_${filterKey}`, { config: { private: true } })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_settings",
          filter: `key=eq.${filterKey}`,
        },
        (payload) => {
          const row = payload.new as { value?: string } | null;
          const v = row?.value;
          if (!v) return;
          setSettings((prev) => ({
            ...prev,
            liveTableDensity: coerceLiveTableDensity(v),
          }));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [mounted, authLoaded, user?.id]);

  useEffect(() => {
    if (!mounted || !authLoaded) return;
    const skipServer =
      !isSupabaseConfigured() || !user || user.id === "demo";
    if (skipServer) return;

    let cancelled = false;
    const filterKey = PII_SENSITIVE_DISPLAY_MODE_APP_SETTINGS_KEY;

    void (async () => {
      const mode = await fetchPiiSensitiveDisplayModeFromServer();
      if (cancelled) return;
      setSettings((prev) => ({ ...prev, piiSensitiveDisplayMode: mode ?? "hidden_copy" }));
    })();

    if (isRealtimeDisabledForClient()) {
      const interval = window.setInterval(async () => {
        if (!shouldPollInBrowser()) return;
        const mode = await fetchPiiSensitiveDisplayModeFromServer();
        if (cancelled) return;
        setSettings((prev) => ({ ...prev, piiSensitiveDisplayMode: mode ?? "hidden_copy" }));
      }, SETTINGS_FALLBACK_POLL_MS);
      return () => {
        cancelled = true;
        window.clearInterval(interval);
      };
    }

    const channel = supabase
      .channel(`app_settings_${filterKey}`, { config: { private: true } })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_settings",
          filter: `key=eq.${filterKey}`,
        },
        (payload) => {
          const row = payload.new as { value?: string } | null;
          const v = row?.value;
          setSettings((prev) => ({
            ...prev,
            piiSensitiveDisplayMode: v === "masked_copy" ? "masked_copy" : "hidden_copy",
          }));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [mounted, authLoaded, user?.id]);

  useEffect(() => {
    if (!mounted || !authLoaded) return;
    const skipServer =
      !isSupabaseConfigured() || !user || user.id === "demo";
    if (skipServer) return;

    let cancelled = false;
    const filterKey = PII_POLICY_MODE_APP_SETTINGS_KEY;

    void (async () => {
      const mode = await fetchPiiPolicyModeFromServer();
      if (cancelled) return;
      setSettings((prev) => ({ ...prev, piiPolicyMode: mode ?? "shadow" }));
    })();

    if (isRealtimeDisabledForClient()) {
      const interval = window.setInterval(async () => {
        if (!shouldPollInBrowser()) return;
        const mode = await fetchPiiPolicyModeFromServer();
        if (cancelled) return;
        setSettings((prev) => ({ ...prev, piiPolicyMode: mode ?? "shadow" }));
      }, SETTINGS_FALLBACK_POLL_MS);
      return () => {
        cancelled = true;
        window.clearInterval(interval);
      };
    }

    const channel = supabase
      .channel(`app_settings_${filterKey}`, { config: { private: true } })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_settings",
          filter: `key=eq.${filterKey}`,
        },
        (payload) => {
          const row = payload.new as { value?: string } | null;
          const v = row?.value;
          if (!v) return;
          setSettings((prev) => ({
            ...prev,
            piiPolicyMode: v === "enforce" ? "enforce" : "shadow",
          }));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [mounted, authLoaded, user?.id]);

  useEffect(() => {
    if (!mounted) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveSettings(settings);
      setInitialSettings(settings);
      if (userHasChangedRef.current) setLastSavedAt(Date.now());
      userHasChangedRef.current = false;
      saveTimeoutRef.current = null;
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [settings, mounted]);

  useEffect(() => {
    return () => {
      if (densityPersistTimerRef.current) clearTimeout(densityPersistTimerRef.current);
      if (piiPolicyModePersistTimerRef.current) clearTimeout(piiPolicyModePersistTimerRef.current);
      if (piiSensitiveDisplayModePersistTimerRef.current) clearTimeout(piiSensitiveDisplayModePersistTimerRef.current);
    };
  }, []);

  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    if (!userHasPermission(user, "settings.edit")) return;
    userHasChangedRef.current = true;
    if (key === "liveTableDensity") {
      liveTableDensityEditedLocallyRef.current = true;
      if (densityPersistTimerRef.current) clearTimeout(densityPersistTimerRef.current);
      densityPersistTimerRef.current = setTimeout(() => {
        densityPersistTimerRef.current = null;
        void persistLiveTableDensityToServer(value as LiveTableDensity);
      }, SAVE_DEBOUNCE_MS);
    }
    if (key === "piiPolicyMode") {
      if (piiPolicyModePersistTimerRef.current) clearTimeout(piiPolicyModePersistTimerRef.current);
      piiPolicyModePersistTimerRef.current = setTimeout(() => {
        piiPolicyModePersistTimerRef.current = null;
        void persistPiiPolicyModeToServer(value as PiiPolicyMode);
      }, SAVE_DEBOUNCE_MS);
    }
    if (key === "piiSensitiveDisplayMode") {
      if (piiSensitiveDisplayModePersistTimerRef.current) clearTimeout(piiSensitiveDisplayModePersistTimerRef.current);
      piiSensitiveDisplayModePersistTimerRef.current = setTimeout(() => {
        piiSensitiveDisplayModePersistTimerRef.current = null;
        void persistPiiSensitiveDisplayModeToServer(value as PiiSensitiveDisplayMode);
      }, SAVE_DEBOUNCE_MS);
    }
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, [user]);

  const resetToDefaults = useCallback(() => {
    if (!userHasPermission(user, "settings.edit")) return;
    setSettings(DEFAULT_SETTINGS);
    setInitialSettings(DEFAULT_SETTINGS);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    }
  }, [user]);

  const resetSection = useCallback((section: SettingsSection) => {
    if (!userHasPermission(user, "settings.edit")) return;
    const keys = SECTION_KEYS[section];
    setSettings((prev) => {
      const next = { ...prev };
      keys.forEach((k) => { (next[k] as unknown) = DEFAULT_SETTINGS[k]; });
      return next;
    });
    setInitialSettings((prev) => {
      const next = { ...prev };
      keys.forEach((k) => { (next[k] as unknown) = DEFAULT_SETTINGS[k]; });
      return next;
    });
    setLastSavedAt(Date.now());
  }, [user]);

  const isDirty =
    mounted &&
    JSON.stringify(settings) !== JSON.stringify(initialSettings);

  const save = useCallback(() => {
    if (!userHasPermission(user, "settings.edit")) return;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    setInitialSettings(settings);
    saveSettings(settings);
    setLastSavedAt(Date.now());
  }, [settings, user]);

  const value: SettingsContextType = {
    settings,
    setSettings,
    updateSetting,
    resetToDefaults,
    resetSection,
    isDirty,
    save,
    lastSavedAt,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (ctx === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return ctx;
}
