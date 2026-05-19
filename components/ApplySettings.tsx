"use client";

import { useEffect } from "react";
import { useSettings, ACCENT_COLORS } from "@/contexts/settings-context";
import type { Theme } from "@/contexts/settings-context";

const ACCENT_VALUES = ACCENT_COLORS.map((c) => c.value);

function getEffectiveDark(theme: Theme): boolean {
  if (theme === "light") return false;
  if (theme === "dark") return true;
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ApplySettings() {
  const { settings } = useSettings();

  useEffect(() => {
    const dark = getEffectiveDark(settings.theme);
    document.documentElement.classList.toggle("dark", dark);
  }, [settings.theme]);

  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  // Accent rengi: HTML root'a `accent-<renk>` class'ı uygula; diğer accent class'ları temizle.
  useEffect(() => {
    const root = document.documentElement;
    for (const v of ACCENT_VALUES) root.classList.remove(`accent-${v}`);
    if (settings.accentColor && settings.accentColor !== "blue") {
      // "blue" varsayılan (override yok)
      root.classList.add(`accent-${settings.accentColor}`);
    }
  }, [settings.accentColor]);

  useEffect(() => {
    if (settings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      document.documentElement.classList.toggle("dark", mq.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [settings.theme]);

  return null;
}
