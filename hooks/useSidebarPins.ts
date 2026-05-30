"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Sidebar nav item pinleme — localStorage'da href listesi tutar.
 *
 * Davranış:
 *   - Pinli item, ait olduğu modül kolonunda en üstte ayrı bir "Sabit"
 *     bölümünde gösterilir
 *   - Aynı item modül listesinde de görünür (kullanıcı pinli ise üstte
 *     erişip, modülün doğal akışını da koruyabilir)
 *   - SSR-safe: ilk render'da boş, mount'tan sonra hydrate olur
 */
const STORAGE_KEY = "panel.pinnedNav.v1";

function loadPins(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

function savePins(pins: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
  } catch {
    /* quota dolmuş — sessiz */
  }
}

export function useSidebarPins() {
  const [pins, setPins] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPins(loadPins());
    setHydrated(true);
  }, []);

  const isPinned = useCallback((href: string) => pins.includes(href), [pins]);

  const togglePin = useCallback((href: string) => {
    setPins((prev) => {
      const next = prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href];
      savePins(next);
      return next;
    });
  }, []);

  const clearPins = useCallback(() => {
    setPins([]);
    savePins([]);
  }, []);

  return { pins, isPinned, togglePin, clearPins, hydrated };
}
