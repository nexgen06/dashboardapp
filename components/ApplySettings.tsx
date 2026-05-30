"use client";

import { useEffect } from "react";
import { useSettings, ACCENT_COLORS } from "@/contexts/settings-context";
import type { Theme } from "@/contexts/settings-context";
import { ACCENT_TONE_KEYS, buildAccentPalette } from "@/lib/brandColor";

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
  // brandColor (D2) varsa preset'i override eder — class kaldırılır, inline --accent-* yazılır.
  useEffect(() => {
    const root = document.documentElement;
    for (const v of ACCENT_VALUES) root.classList.remove(`accent-${v}`);

    // 1) Eski/varsayılan inline brand override'larını temizle
    for (const tone of ACCENT_TONE_KEYS) {
      root.style.removeProperty(`--accent-${tone}`);
    }

    // 2) Brand color varsa palette üretip inline yaz (preset'i tamamen ezer)
    if (settings.brandColor) {
      const palette = buildAccentPalette(settings.brandColor);
      if (palette) {
        for (const [tone, hsl] of Object.entries(palette)) {
          root.style.setProperty(`--accent-${tone}`, hsl);
        }
        return; // brandColor uygulandı, preset class atlanır
      }
      // Geçersiz HEX → preset'e fallback
    }

    // 3) Preset accent class'ı (varsayılan blue ise hiçbir şey yapılmaz)
    if (settings.accentColor && settings.accentColor !== "blue") {
      root.classList.add(`accent-${settings.accentColor}`);
    }
  }, [settings.accentColor, settings.brandColor]);

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
