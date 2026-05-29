"use client";

import { Button } from "@/components/ui/button";
import { useSettings } from "@/contexts/settings-context";
import type { Language, DateFormat } from "@/contexts/settings-context";
import { RotateCcw } from "lucide-react";
import { SettingRow } from "@/components/settings/SettingRow";
import { matchesSearch } from "@/components/settings/settingsSearch";
import type { SettingsPanelProps } from "@/components/settings/settingsPanelTypes";

export function GenelAyarlarPanel({ searchQuery, resetSection, canResetSettings }: SettingsPanelProps) {
  const { settings, updateSetting } = useSettings();

  return (
    <div className="space-y-2">
      {matchesSearch(searchQuery, "Dil", "Arayüz dilini seçin.") && (
      <SettingRow
        label="Dil"
        description="Arayüz dilini seçin. Tüm etiket ve mesajlar bu dile göre gösterilir."
      >
        <select
          value={settings.language}
          onChange={(e) => updateSetting("language", e.target.value as Language)}
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        >
          <option value="tr">Türkçe</option>
          <option value="en">English</option>
        </select>
      </SettingRow>
      )}
      {matchesSearch(searchQuery, "Tarih formatı", "Tarihlerin gösterim şekli.") && (
      <SettingRow
        label="Tarih formatı"
        description="Tarihlerin gösterim şekli. Tablolarda ve bildirimlerde kullanılır."
      >
        <select
          value={settings.dateFormat}
          onChange={(e) => updateSetting("dateFormat", e.target.value as DateFormat)}
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        >
          <option value="DD.MM.YYYY">GG.AA.YYYY (31.12.2025)</option>
          <option value="YYYY-MM-DD">YYYY-AA-GG (2025-12-31)</option>
          <option value="MM/DD/YYYY">AA/GG/YYYY (12/31/2025)</option>
        </select>
      </SettingRow>
      )}
      {searchQuery.trim() && !matchesSearch(searchQuery, "Dil", "Arayüz dilini seçin.") && !matchesSearch(searchQuery, "Tarih formatı", "Tarihlerin gösterim şekli.") && (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Arama kriterine uyan ayar yok.</p>
      )}
      {canResetSettings && (
      <div className="pt-4">
        <Button type="button" variant="outline" size="sm" onClick={() => resetSection("genel")} className="text-slate-600 dark:text-slate-400">
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
          Bu bölümü varsayılana sıfırla
        </Button>
      </div>
      )}
    </div>
  );
}
