"use client";

import { createContext, useContext } from "react";
import { useNotificationSummary, type NotificationSummary } from "@/hooks/useNotificationSummary";

/**
 * Bildirim verisi için tek source of truth.
 *
 * Önceden Header, MobileBottomNav ve /bildirimler her biri ayrı
 * useNotificationSummary çağırıyordu → her biri kendi state'i, kendi realtime
 * subscription'ı, kendi fetch'ini tutuyordu. Bu yüzden:
 *   - Bell'de unread var, sayfada görünmüyor (veya tersi)
 *   - Bazen mesajlar hiç görünmüyor
 *   - 3 ayrı realtime subscription → fazla WebSocket trafik
 *
 * Bu provider tek instance açar, tüketenler context'ten okur.
 */

const NotificationCtx = createContext<NotificationSummary | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const summary = useNotificationSummary();
  return <NotificationCtx.Provider value={summary}>{children}</NotificationCtx.Provider>;
}

export function useNotifications(): NotificationSummary {
  const ctx = useContext(NotificationCtx);
  if (!ctx) {
    throw new Error("useNotifications must be used inside <NotificationProvider>");
  }
  return ctx;
}
