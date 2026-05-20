"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, Loader2, Shield, AlertTriangle, Users } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useToast } from "@/components/ui/toast";
import {
  listEmailSettings,
  updateEmailSetting,
  type EmailNotificationSetting,
  type EmailNotificationEvent,
} from "@/lib/emailNotificationSettings";
import { cn } from "@/lib/utils";

export default function EmailNotifAdminPage() {
  const { hasPermission, isLoaded, isAdmin } = useAuth();
  const canManage = isAdmin && hasPermission("area.emailNotifAdmin");
  const toast = useToast();

  const [list, setList] = useState<EmailNotificationSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<EmailNotificationEvent | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setList(await listEmailSettings());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canManage) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  const handleToggle = async (s: EmailNotificationSetting) => {
    setBusyKey(s.event_key);
    try {
      await updateEmailSetting(s.event_key, !s.enabled);
      setList((prev) =>
        prev.map((x) => (x.event_key === s.event_key ? { ...x, enabled: !s.enabled } : x))
      );
      toast.success(
        !s.enabled
          ? `"${s.display_name}" e-postası AÇILDI`
          : `"${s.display_name}" e-postası KAPATILDI`,
        { durationMs: 3000 }
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Güncellenemedi");
    } finally {
      setBusyKey(null);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex max-w-2xl items-center justify-center gap-2 px-6 py-16 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Yükleniyor…
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="container max-w-2xl py-16">
        <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-700 dark:bg-amber-950/30">
          <Shield className="mx-auto mb-3 h-12 w-12 text-amber-600 dark:text-amber-400" />
          <p className="font-medium text-slate-800 dark:text-slate-200">
            E-posta bildirim ayarlarına erişim yetkiniz yok.
          </p>
          <Button variant="outline" asChild className="mt-4">
            <Link href="/">{`Dashboard'a dön`}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const enabledCount = list.filter((s) => s.enabled).length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumb items={[{ label: "Yönetim" }, { label: "E-posta bildirim ayarları" }]} />

      <header className="flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
        <Mail className="h-5 w-5 text-slate-500" aria-hidden />
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          E-posta bildirim ayarları
        </h1>
        <span className="text-xs text-slate-500">
          · {enabledCount} / {list.length} aktif
        </span>
      </header>

      {/* Durum banner'ı */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
        <div>
          <p className="font-semibold">Aktif olaylar</p>
          <p className="mt-0.5">
            <strong>Yeni duyuru</strong> olayı için gerçek e-posta gönderimi aktif (Resend
            entegrasyonu hazır). Toggle açıldıktan sonra admin duyuru yayımlayınca tüm
            kullanıcılara mail gider. Diğer olaylar (görev atandı, yorum, vb.) sıradaki
            güncellemelerle eklenecek — toggle açık olsa bile mail gitmez.
          </p>
          <p className="mt-1.5 text-[11px] opacity-80">
            Ön koşul: <code>RESEND_API_KEY</code> ve <code>NEXT_PUBLIC_APP_URL</code> env
            değişkenleri tanımlı olmalı. Free tier 3000 mail/ay.
          </p>
        </div>
      </div>

      {loading && list.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800/40">
          {list.map((s) => (
            <li key={s.event_key} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {s.display_name}
                  </h3>
                  <code className="text-[10px] text-slate-400">{s.event_key}</code>
                </div>
                {s.description && (
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    {s.description}
                  </p>
                )}
                <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-500">
                  <Users className="h-2.5 w-2.5" />
                  Alıcı: {s.recipient}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleToggle(s)}
                disabled={busyKey === s.event_key}
                role="switch"
                aria-checked={s.enabled}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                  s.enabled
                    ? "bg-emerald-500"
                    : "bg-slate-300 dark:bg-slate-600",
                  busyKey === s.event_key && "opacity-60"
                )}
                aria-label={`${s.display_name} e-postasını ${s.enabled ? "kapat" : "aç"}`}
              >
                <span
                  className={cn(
                    "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
                    s.enabled ? "translate-x-5" : "translate-x-0.5"
                  )}
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Değişiklikler anında kaydedilir. Bir toggle açıldıktan sonra, ilgili olay
        oluşunca (örn. yeni duyuru) Phase 2&apos;deki Edge Function tetiklenecek ve
        Resend üzerinden e-posta gönderilecek. Şu anda sadece bu ön ayar saklanıyor.
      </p>
    </div>
  );
}
