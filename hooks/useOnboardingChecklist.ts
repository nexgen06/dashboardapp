"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  Command,
  ListTodo,
  Palette,
  UserCircle2,
  Keyboard,
  Sparkles,
  Bell,
  FolderPlus,
  Image as ImageIcon,
} from "lucide-react";
import type { RoleId } from "@/types/permissions";

/**
 * A6 — Onboarding Checklist
 *
 * Yeni kullanıcının ilk 5-10 dakikada keşfetmesi gereken eylemleri
 * checklist olarak sunar. Adımlar role'e göre filtrelenir.
 *
 * Auto-detect: bazı adımlar kullanıcı eylemi olduğunda otomatik tamamlanır
 * (örn. ⌘K paleti açıldı → step:command-palette ✓). Diğerleri kullanıcının
 * "Yaptım" demesini bekler (manuel mark).
 *
 * Persistence: localStorage per-user. Tamamlanma zamanı saklanır
 * (gelecekte streak/ROI ölçümü için).
 */

export type OnboardingStepId =
  // Tüm roller
  | "explore-sidebar"
  | "open-command-palette"
  | "explore-guide"
  | "learn-shortcuts"
  | "set-theme"
  | "open-notifications"
  // Member-spesifik
  | "view-my-tasks"
  // Project manager / admin
  | "open-canli-tablo"
  | "try-bulk-action"
  // Admin
  | "brand-color"
  | "upload-logo"
  | "invite-users";

export type OnboardingStep = {
  id: OnboardingStepId;
  title: string;
  description: string;
  icon: LucideIcon;
  /** CTA — tıklayınca gidilecek sayfa veya tetiklenecek eylem */
  action: { kind: "navigate"; href: string } | { kind: "event"; eventName: string };
  /** Hangi roller için geçerli (boşsa tüm roller) */
  roles?: RoleId[];
  /** Otomatik tamamlanma sinyali — true dönerse step ✓ olur */
  autoDetect?: () => boolean;
};

/**
 * Step tanımları — role bazlı filtre uygulanır
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "explore-sidebar",
    title: "Sidebar modüllerini keşfet",
    description: "Sol kenardan Çalışma / Veri / Yönetim / Kişisel modülleri arasında geç",
    icon: UserCircle2,
    action: { kind: "navigate", href: "/" },
  },
  {
    id: "open-command-palette",
    title: "Komut Paleti'ni dene",
    description: "⌘K (Mac) veya Ctrl+K (Win) — her şey için tek giriş noktası",
    icon: Command,
    action: { kind: "event", eventName: "commandpalette:open" },
  },
  {
    id: "view-my-tasks",
    title: "Görevlerimi gör",
    description: "Sana atanan açık görevler tek sayfada",
    icon: ListTodo,
    action: { kind: "navigate", href: "/gorevlerim" },
  },
  {
    id: "open-canli-tablo",
    title: "Canlı Tablo'ya gir",
    description: "Tüm görevlerin akıllı tablosu — filtre, sıralama, gruplama",
    icon: ListTodo,
    action: { kind: "navigate", href: "/canli-tablo" },
    roles: ["admin", "project_manager", "member"],
  },
  {
    id: "try-bulk-action",
    title: "Toplu işlem dene",
    description: "Tabloda 3+ satır seç → üstte aksiyon barı belirir",
    icon: Sparkles,
    action: { kind: "navigate", href: "/canli-tablo" },
    roles: ["admin", "project_manager"],
  },
  {
    id: "open-notifications",
    title: "Bildirim Inbox Zero'yu dene",
    description: "⌘+Shift+E → klavye ile bildirimleri 30 saniyede temizle",
    icon: Bell,
    action: { kind: "navigate", href: "/bildirimler" },
  },
  {
    id: "set-theme",
    title: "Tema ayarla",
    description: "Açık / Koyu / Sisteme uy — gözünü yormayan moda geç",
    icon: Palette,
    action: { kind: "navigate", href: "/ayarlar" },
  },
  {
    id: "brand-color",
    title: "Kurumsal renginizi tanıtın",
    description: "Marka HEX'ini girin — tüm vurgular o renge döner",
    icon: Palette,
    action: { kind: "navigate", href: "/ayarlar" },
    roles: ["admin"],
  },
  {
    id: "upload-logo",
    title: "Kurumsal logo yükleyin",
    description: "Sidebar'da \"Panel\" yerine logonuz görünür",
    icon: ImageIcon,
    action: { kind: "navigate", href: "/ayarlar" },
    roles: ["admin"],
  },
  {
    id: "invite-users",
    title: "Ekibi davet edin",
    description: "Kullanıcı yetkileri sayfasından ekip üyelerini ekleyin",
    icon: FolderPlus,
    action: { kind: "navigate", href: "/yonetim/kullanici-yetkileri" },
    roles: ["admin"],
  },
  {
    id: "learn-shortcuts",
    title: "Klavye kısayollarını öğren",
    description: "? tuşuna bas — tüm kısayollar tek ekranda",
    icon: Keyboard,
    action: { kind: "event", eventName: "keyboardshortcuts:open" },
  },
  {
    id: "explore-guide",
    title: "Kullanıcı rehberini gez",
    description: "Tüm özellikler için adım adım rehber",
    icon: Sparkles,
    action: { kind: "navigate", href: "/rehber" },
  },
];

const STORAGE_KEY_PREFIX = "panel.onboardingChecklist.v1";

type Persisted = {
  /** stepId → ISO timestamp (tamamlanma anı) */
  completed: Record<string, string>;
  /** Kullanıcı paneli açık tutmak istemiyor */
  dismissed: boolean;
};

function loadState(userId: string): Persisted {
  if (typeof window === "undefined") return { completed: {}, dismissed: false };
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}:${userId}`);
    if (!raw) return { completed: {}, dismissed: false };
    const parsed = JSON.parse(raw);
    return {
      completed: parsed?.completed && typeof parsed.completed === "object" ? parsed.completed : {},
      dismissed: !!parsed?.dismissed,
    };
  } catch {
    return { completed: {}, dismissed: false };
  }
}

function saveState(userId: string, state: Persisted) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${STORAGE_KEY_PREFIX}:${userId}`, JSON.stringify(state));
  } catch {
    /* quota — sessiz */
  }
}

export function useOnboardingChecklist(opts: { userId: string | null; roleId: RoleId | null }) {
  const { userId, roleId } = opts;
  const [state, setState] = useState<Persisted>({ completed: {}, dismissed: false });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!userId) {
      setHydrated(true);
      return;
    }
    setState(loadState(userId));
    setHydrated(true);
  }, [userId]);

  const update = useCallback(
    (updater: (prev: Persisted) => Persisted) => {
      if (!userId) return;
      setState((prev) => {
        const next = updater(prev);
        saveState(userId, next);
        return next;
      });
    },
    [userId]
  );

  const markComplete = useCallback(
    (id: OnboardingStepId) => {
      update((prev) => {
        if (prev.completed[id]) return prev;
        return { ...prev, completed: { ...prev.completed, [id]: new Date().toISOString() } };
      });
    },
    [update]
  );

  const reset = useCallback(() => {
    update(() => ({ completed: {}, dismissed: false }));
  }, [update]);

  const dismiss = useCallback(() => {
    update((prev) => ({ ...prev, dismissed: true }));
  }, [update]);

  const undismiss = useCallback(() => {
    update((prev) => ({ ...prev, dismissed: false }));
  }, [update]);

  // Role-filtered + sorted adımlar
  const steps = useMemo(() => {
    if (!roleId) return ONBOARDING_STEPS;
    return ONBOARDING_STEPS.filter((s) => !s.roles || s.roles.includes(roleId));
  }, [roleId]);

  const completedCount = useMemo(
    () => steps.filter((s) => state.completed[s.id]).length,
    [steps, state.completed]
  );

  const totalCount = steps.length;
  const progress = totalCount === 0 ? 1 : completedCount / totalCount;
  const isComplete = totalCount > 0 && completedCount === totalCount;

  // Auto-detect: window event'lerini dinle
  useEffect(() => {
    if (!hydrated || !userId) return;
    const wireEvent = (eventName: string, stepId: OnboardingStepId) => {
      const handler = () => markComplete(stepId);
      window.addEventListener(eventName, handler);
      return () => window.removeEventListener(eventName, handler);
    };
    const cleanups = [
      wireEvent("commandpalette:open", "open-command-palette"),
      wireEvent("keyboardshortcuts:open", "learn-shortcuts"),
    ];
    return () => cleanups.forEach((c) => c());
  }, [hydrated, userId, markComplete]);

  return {
    steps,
    completedCount,
    totalCount,
    progress,
    isComplete,
    isCompleted: (id: OnboardingStepId) => !!state.completed[id],
    dismissed: state.dismissed,
    hydrated,
    markComplete,
    dismiss,
    undismiss,
    reset,
  };
}
