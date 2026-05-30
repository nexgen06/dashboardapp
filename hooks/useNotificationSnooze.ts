"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Bildirim erteleme (snooze) — Superhuman/Linear pattern.
 *
 * Bildirim id'si (genelde sourceKey) → ISO timestamp eşleştirmesi
 * localStorage'da tutulur. Süresi geçen snooze'lar her tick'te
 * (60sn) temizlenir, böylece bildirim listede otomatik geri görünür.
 *
 * MVP: client-side. İleride DB migration ile
 * `notifications.snoozed_until` alanına taşınabilir.
 */
const STORAGE_KEY = "panel.notifSnooze.v1";
const POLL_INTERVAL_MS = 60_000;

export type SnoozePreset = "1h" | "tonight" | "tomorrow" | "monday";

export const SNOOZE_PRESETS: ReadonlyArray<{
  id: SnoozePreset;
  label: string;
  short: string;
}> = [
  { id: "1h", label: "1 saat sonra", short: "1 saat" },
  { id: "tonight", label: "Bu akşam 18:00", short: "Bu akşam" },
  { id: "tomorrow", label: "Yarın 09:00", short: "Yarın" },
  { id: "monday", label: "Pazartesi 09:00", short: "Pazartesi" },
];

/** Preset → çözülmüş hedef Date */
export function resolveSnoozePreset(preset: SnoozePreset, now: Date = new Date()): Date {
  const d = new Date(now);
  switch (preset) {
    case "1h":
      d.setHours(d.getHours() + 1);
      return d;
    case "tonight": {
      // Bugün 18:00; eğer şu an 18'i geçmişse yarın 18:00
      d.setHours(18, 0, 0, 0);
      if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
      return d;
    }
    case "tomorrow": {
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    }
    case "monday": {
      // Sonraki pazartesi 09:00 (bugün pazartesi ve 09'dan önceyse bugün)
      const day = d.getDay(); // 0 paz, 1 ptesi
      const offset = day === 1 ? (d.getHours() >= 9 ? 7 : 0) : (8 - day) % 7 || 7;
      d.setDate(d.getDate() + offset);
      d.setHours(9, 0, 0, 0);
      return d;
    }
    default:
      return d;
  }
}

type SnoozeMap = Record<string, string>; // key → ISO

function load(): SnoozeMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as SnoozeMap;
  } catch {
    return {};
  }
}

function save(map: SnoozeMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota — sessiz */
  }
}

/** Süresi geçenleri kırp; değişiklik varsa yeni map döner */
function prune(map: SnoozeMap, now: number): { map: SnoozeMap; changed: boolean } {
  let changed = false;
  const next: SnoozeMap = {};
  for (const [k, v] of Object.entries(map)) {
    const t = Date.parse(v);
    if (Number.isFinite(t) && t > now) {
      next[k] = v;
    } else {
      changed = true;
    }
  }
  return { map: next, changed };
}

export function useNotificationSnooze() {
  const [map, setMap] = useState<SnoozeMap>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setMap(load());
    setHydrated(true);
  }, []);

  // Periyodik prune — süresi gelenleri inbox'a geri al
  useEffect(() => {
    if (!hydrated) return;
    const tick = () => {
      setMap((prev) => {
        const { map: next, changed } = prune(prev, Date.now());
        if (changed) save(next);
        return changed ? next : prev;
      });
    };
    tick();
    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [hydrated]);

  const isSnoozed = useCallback(
    (key: string) => {
      const t = map[key] ? Date.parse(map[key]) : NaN;
      return Number.isFinite(t) && t > Date.now();
    },
    [map]
  );

  const snoozeUntil = useCallback((key: string, until: Date) => {
    setMap((prev) => {
      const next = { ...prev, [key]: until.toISOString() };
      save(next);
      return next;
    });
  }, []);

  const snooze = useCallback(
    (key: string, preset: SnoozePreset) => {
      snoozeUntil(key, resolveSnoozePreset(preset));
    },
    [snoozeUntil]
  );

  const unsnooze = useCallback((key: string) => {
    setMap((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      save(next);
      return next;
    });
  }, []);

  const snoozedUntil = useCallback(
    (key: string): Date | null => {
      const raw = map[key];
      if (!raw) return null;
      const t = Date.parse(raw);
      if (!Number.isFinite(t) || t <= Date.now()) return null;
      return new Date(t);
    },
    [map]
  );

  return { hydrated, isSnoozed, snooze, snoozeUntil, unsnooze, snoozedUntil, snoozedMap: map };
}
