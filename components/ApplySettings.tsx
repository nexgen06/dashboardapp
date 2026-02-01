"use client";

import { useEffect } from "react";
import { useSettings } from "@/contexts/settings-context";
import type { Theme } from "@/contexts/settings-context";

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
