"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";

const STORAGE_KEY = "dashboard-settings";
const SAVE_DEBOUNCE_MS = 800;

export type Theme = "light" | "dark" | "system";
export type Language = "tr" | "en";
export type DateFormat = "DD.MM.YYYY" | "YYYY-MM-DD" | "MM/DD/YYYY";
export type LogLevel = "error" | "warn" | "info" | "debug";

export type Settings = {
  theme: Theme;
  language: Language;
  dateFormat: DateFormat;
  sidebarCollapsedByDefault: boolean;
  notificationsEmail: boolean;
  notificationsPush: boolean;
  notificationsSound: boolean;
  debugMode: boolean;
  logLevel: LogLevel;
  experimentalFeatures: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  language: "tr",
  dateFormat: "DD.MM.YYYY",
  sidebarCollapsedByDefault: false,
  notificationsEmail: true,
  notificationsPush: false,
  notificationsSound: true,
  debugMode: false,
  logLevel: "info",
  experimentalFeatures: false,
};

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
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

export type SettingsSection = "genel" | "gorunum" | "bildirimler" | "gelismis";

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
  gorunum: ["theme", "sidebarCollapsedByDefault"],
  bildirimler: ["notificationsEmail", "notificationsPush", "notificationsSound"],
  gelismis: ["debugMode", "logLevel", "experimentalFeatures"],
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [initialSettings, setInitialSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [mounted, setMounted] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userHasChangedRef = useRef(false);

  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    setInitialSettings(loaded);
    setMounted(true);
  }, []);

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

  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    userHasChangedRef.current = true;
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    setInitialSettings(DEFAULT_SETTINGS);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    }
  }, []);

  const resetSection = useCallback((section: SettingsSection) => {
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
  }, []);

  const isDirty =
    mounted &&
    JSON.stringify(settings) !== JSON.stringify(initialSettings);

  const save = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    setInitialSettings(settings);
    saveSettings(settings);
    setLastSavedAt(Date.now());
  }, [settings]);

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
