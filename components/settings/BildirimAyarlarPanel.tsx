"use client";

import { Button } from "@/components/ui/button";
import { useSettings } from "@/contexts/settings-context";
import { RotateCcw } from "lucide-react";
import { requestNotificationPermission, notificationApiAvailable } from "@/lib/browserNotifications";
import { SettingRow } from "@/components/settings/SettingRow";
import { matchesSearch } from "@/components/settings/settingsSearch";
import type { SettingsPanelProps } from "@/components/settings/settingsPanelTypes";

export function BildirimAyarlarPanel({ searchQuery, resetSection, canResetSettings }: SettingsPanelProps) {
  const { settings, updateSetting } = useSettings();

  const emailMatch = matchesSearch(searchQuery, "E-posta bildirimleri", "Önemli olaylarda e-posta alın.");
  const pushMatch = matchesSearch(searchQuery, "Tarayıcı bildirimleri", "Push bildirimleri (tarayıcı izni gerekir).");
  const soundMatch = matchesSearch(searchQuery, "Ses", "Yeni bildirimde ses çalsın.");
  const noneMatch = searchQuery.trim() && !emailMatch && !pushMatch && !soundMatch;

  return (
    <div className="space-y-2">
      {emailMatch && (
      <SettingRow
        label="E-posta bildirimleri"
        description="Önemli olaylarda e-posta alın. Görev atamaları ve hatırlatmalar için kullanılır."
      >
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.notificationsEmail}
            onChange={(e) => updateSetting("notificationsEmail", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">E-posta bildirimlerini aç</span>
        </label>
      </SettingRow>
      )}
      {pushMatch && (
      <SettingRow
        label="Tarayıcı bildirimleri"
        description="Proje görüntüleme uyarıları için tarayıcı bildirimi (Notification API). İlk açışta siteden izin istenir; Reddettiyseniz tarayıcı ayarlarından siteye izin vermeniz gerekir."
      >
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notificationsPush}
              onChange={async (e) => {
                const checked = e.target.checked;
                updateSetting("notificationsPush", checked);
                if (checked && notificationApiAvailable()) {
                  await requestNotificationPermission();
                }
              }}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Tarayıcı bildirimlerini aç</span>
          </label>
          {settings.notificationsPush &&
            notificationApiAvailable() &&
            Notification.permission === "denied" && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Bildirimler engellenmiş. Tarayıcıda site ayarlarından bu site için bildirime izin verin.
              </p>
            )}
        </div>
      </SettingRow>
      )}
      {soundMatch && (
      <SettingRow
        label="Ses"
        description="Yeni bildirimde ses çalsın."
      >
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.notificationsSound}
            onChange={(e) => updateSetting("notificationsSound", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">Bildirim sesini aç</span>
        </label>
      </SettingRow>
      )}
      {noneMatch && <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Arama kriterine uyan ayar yok.</p>}
      {canResetSettings && (
      <div className="pt-4">
        <Button type="button" variant="outline" size="sm" onClick={() => resetSection("bildirimler")} className="text-slate-600 dark:text-slate-400">
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
          Bu bölümü varsayılana sıfırla
        </Button>
      </div>
      )}
    </div>
  );
}
