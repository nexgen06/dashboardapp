"use client";

import { Button } from "@/components/ui/button";
import { useSettings, getStatusOptions, getPriorityOptions } from "@/contexts/settings-context";
import { RotateCcw } from "lucide-react";
import { SettingRow } from "@/components/settings/SettingRow";
import { matchesSearch } from "@/components/settings/settingsSearch";
import type { SettingsPanelProps } from "@/components/settings/settingsPanelTypes";

export function GorevlerAyarlarPanel({ searchQuery, resetSection, canResetSettings }: SettingsPanelProps) {
  const { settings, updateSetting } = useSettings();
  const statusOptions = getStatusOptions(settings);
  const priorityOptions = getPriorityOptions(settings);

  const statusMatch = matchesSearch(searchQuery, "Durum listesi", "Görev durumları. Virgül veya satırla ayırın.");
  const priorityMatch = matchesSearch(searchQuery, "Öncelik listesi", "Görev öncelikleri. Virgül veya satırla ayırın.");
  const defaultStatusMatch = matchesSearch(searchQuery, "Varsayılan durum", "Yeni görevde seçili gelecek durum.");
  const defaultPriorityMatch = matchesSearch(searchQuery, "Varsayılan öncelik", "Yeni görevde seçili gelecek öncelik.");
  const summaryKeysMatch = matchesSearch(
    searchQuery,
    "Özet başlık sütunları",
    "Görev özeti ve acil görevler listesinde satır başlığı için extra_data anahtarları."
  );
  const urgentTokensMatch = matchesSearch(
    searchQuery,
    "Acil öncelik değerleri",
    "Hangi priority değerleri acil görev sayılır."
  );
  const noneMatch =
    searchQuery.trim() &&
    !statusMatch &&
    !priorityMatch &&
    !defaultStatusMatch &&
    !defaultPriorityMatch &&
    !summaryKeysMatch &&
    !urgentTokensMatch;

  return (
    <div className="space-y-2">
      {statusMatch && (
        <SettingRow
          label="Durum listesi"
          description="Görev durumları. Virgül veya satırla ayırın. Boş bırakırsanız varsayılan (Yapılacak, Devam, Tamamlandı) kullanılır."
        >
          <textarea
            value={settings.customStatusList}
            onChange={(e) => updateSetting("customStatusList", e.target.value)}
            placeholder="Yapılacak, Devam, Tamamlandı"
            rows={2}
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
        </SettingRow>
      )}
      {priorityMatch && (
        <SettingRow
          label="Öncelik listesi"
          description="Görev öncelikleri. Virgül veya satırla ayırın. Boş bırakırsanız varsayılan (High, Medium, Low) kullanılır."
        >
          <textarea
            value={settings.customPriorityList}
            onChange={(e) => updateSetting("customPriorityList", e.target.value)}
            placeholder="High, Medium, Low"
            rows={2}
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
        </SettingRow>
      )}
      {defaultStatusMatch && (
        <SettingRow label="Varsayılan durum" description="Yeni görev eklerken formda seçili gelecek durum.">
          <select
            value={statusOptions.includes(settings.defaultTaskStatus) ? settings.defaultTaskStatus : statusOptions[0] ?? "Yapılacak"}
            onChange={(e) => updateSetting("defaultTaskStatus", e.target.value)}
            className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </SettingRow>
      )}
      {defaultPriorityMatch && (
        <SettingRow label="Varsayılan öncelik" description="Yeni görev eklerken formda seçili gelecek öncelik.">
          <select
            value={priorityOptions.includes(settings.defaultTaskPriority) ? settings.defaultTaskPriority : priorityOptions[0] ?? "Medium"}
            onChange={(e) => updateSetting("defaultTaskPriority", e.target.value)}
            className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          >
            {priorityOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </SettingRow>
      )}
      {summaryKeysMatch && (
        <SettingRow
          label="Özet başlık sütunları (extra_data)"
          description="Canlı tablo ‘Görev özeti’ ve ‘Acil görevler’ satırında `content` boşsa bu isimler sırayla `extra_data` içinde aranır (ör. Başlık, Ticket). Virgül veya satır ile ayırın. Boş bırakırsanız varsayılan sabit liste kullanılır."
        >
          <textarea
            value={settings.taskSummaryPreferredExtraKeys}
            onChange={(e) => updateSetting("taskSummaryPreferredExtraKeys", e.target.value)}
            placeholder="Başlık, Ticket, Görev"
            rows={2}
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
        </SettingRow>
      )}
      {urgentTokensMatch && (
        <SettingRow
          label="Acil öncelik değerleri (priority alanı)"
          description="Görev özeti ‘Acil görevler’ bölümünde `priority` tam olarak bu değerlerden biriyle eşleşiyorsa (büyük/küçük harf duyarsız) yüksek öncelik sayılır. Virgül veya satır ile ayırın. Boş bırakırsanız: high, yüksek, kritik, p1, acil, urgent."
        >
          <textarea
            value={settings.urgentPriorityTokens}
            onChange={(e) => updateSetting("urgentPriorityTokens", e.target.value)}
            placeholder="High, Yüksek, Kritik"
            rows={2}
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
        </SettingRow>
      )}
      {noneMatch && <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Arama kriterine uyan ayar yok.</p>}
      {canResetSettings && (
      <div className="pt-4">
        <Button type="button" variant="outline" size="sm" onClick={() => resetSection("gorevler")} className="text-slate-600 dark:text-slate-400">
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
          Bu bölümü varsayılana sıfırla
        </Button>
      </div>
      )}
    </div>
  );
}
