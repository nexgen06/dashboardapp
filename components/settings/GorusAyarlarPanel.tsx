"use client";

import { Button } from "@/components/ui/button";
import { useSettings, ACCENT_COLORS } from "@/contexts/settings-context";
import type { Theme, LiveTableDensity, LiveTableTemplate, AccentColor } from "@/contexts/settings-context";
import { RotateCcw } from "lucide-react";
import { SettingRow } from "@/components/settings/SettingRow";
import { matchesSearch } from "@/components/settings/settingsSearch";
import type { SettingsPanelProps } from "@/components/settings/settingsPanelTypes";

export function GorusAyarlarPanel({ searchQuery, resetSection, canResetSettings }: SettingsPanelProps) {
  const { settings, updateSetting } = useSettings();

  const themeMatch = matchesSearch(searchQuery, "Tema", "Açık, koyu veya sistem ayarına göre.");
  const accentMatch = matchesSearch(searchQuery, "Vurgu rengi", "Butonların ve seçili öğelerin rengi.");
  const sidebarMatch = matchesSearch(searchQuery, "Sidebar varsayılan", "Sayfa açıldığında sidebar dar mı açık mı olsun.");
  const densityMatch = matchesSearch(
    searchQuery,
    "Canlı Tablo yoğunluğu",
    "Satır aralığı ve yazı boyutu: Yoğun, Normal veya Büyük."
  );
  const templateMatch = matchesSearch(
    searchQuery,
    "Canlı Tablo şablonu",
    "Klasik Excel görünümü veya modern kart dokusu."
  );
  const noneMatch = searchQuery.trim() && !themeMatch && !accentMatch && !sidebarMatch && !densityMatch && !templateMatch;

  return (
    <div className="space-y-2">
      {themeMatch && (
      <SettingRow
        label="Tema"
        description="Açık, koyu veya sistem ayarına göre. Göz yorgunluğunu azaltmak için koyu mod kullanılabilir."
      >
        <select
          value={settings.theme}
          onChange={(e) => updateSetting("theme", e.target.value as Theme)}
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        >
          <option value="light">Açık</option>
          <option value="dark">Koyu</option>
          <option value="system">Sisteme uy</option>
        </select>
      </SettingRow>
      )}
      {accentMatch && (
      <SettingRow
        label="Vurgu rengi"
        description="Butonların, link rengi ve odak halkasının rengi. Diğer renkler etkilenmez."
      >
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Vurgu rengi">
          {ACCENT_COLORS.map((c) => {
            const selected = settings.accentColor === c.value;
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={c.label}
                title={c.label}
                onClick={() => updateSetting("accentColor", c.value as AccentColor)}
                className={
                  selected
                    ? "relative h-8 w-8 rounded-full ring-2 ring-offset-2 ring-slate-900 dark:ring-slate-100 dark:ring-offset-slate-800 transition-transform"
                    : "relative h-8 w-8 rounded-full transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800"
                }
                style={{ backgroundColor: c.preview }}
              >
                {selected && (
                  <span
                    className="absolute inset-0 flex items-center justify-center text-white"
                    aria-hidden
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </SettingRow>
      )}
      {sidebarMatch && (
      <SettingRow
        label="Sidebar varsayılan"
        description="Sayfa açıldığında sidebar dar mı açık mı olsun."
      >
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.sidebarCollapsedByDefault}
            onChange={(e) => updateSetting("sidebarCollapsedByDefault", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">Varsayılan olarak daraltılmış</span>
        </label>
      </SettingRow>
      )}
      {densityMatch && (
      <SettingRow
        label="Canlı Tablo yoğunluğu"
        description="Canlı Tablo sayfasındaki satır aralığı ve yazı boyutu. Aynı seçenek tablo araç çubuğundan da değiştirilebilir."
      >
        <select
          value={settings.liveTableDensity}
          onChange={(e) => updateSetting("liveTableDensity", e.target.value as LiveTableDensity)}
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        >
          <option value="compact">Yoğun</option>
          <option value="normal">Normal</option>
          <option value="comfortable">Büyük</option>
        </select>
      </SettingRow>
      )}
      {templateMatch && (
      <SettingRow
        label="Canlı Tablo şablonu"
        description="Hücre düzeni değişmeden görünüm seçin: Klasik (Excel benzeri) veya Modern (Untitled-UI tarzı)."
      >
        <select
          value={settings.liveTableTemplate}
          onChange={(e) => updateSetting("liveTableTemplate", e.target.value as LiveTableTemplate)}
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        >
          <option value="classic">Klasik</option>
          <option value="modern">Modern</option>
        </select>
      </SettingRow>
      )}
      {noneMatch && <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Arama kriterine uyan ayar yok.</p>}
      {canResetSettings && (
      <div className="pt-4">
        <Button type="button" variant="outline" size="sm" onClick={() => resetSection("gorunum")} className="text-slate-600 dark:text-slate-400">
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
          Bu bölümü varsayılana sıfırla
        </Button>
      </div>
      )}
    </div>
  );
}
