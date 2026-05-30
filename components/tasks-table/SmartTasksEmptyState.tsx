"use client";

import { Upload, PlusCircle, Sparkles, Search, X, Filter, Keyboard } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { openCommandPalette } from "@/components/CommandPalette";
import { cn } from "@/lib/utils";

/**
 * Bağlama duyarlı (smart) boş durum bileşenleri.
 *
 * Üç ana senaryo:
 *   - <OnboardingEmpty>: tablo gerçekten boş + kullanıcı oluşturma yetkisine sahip
 *     → 3 büyük kart: CSV / Komut Paleti / Manuel
 *   - <NoCreatePermissionEmpty>: tablo boş + üye yetkide
 *     → "Yöneticinizle iletişime geçin" yumuşak mesaj
 *   - <FilteredEmpty>: tabloda kayıt var ama filtre/arama eşleşmiyor
 *     → aktif filtreler chip + "Temizle" CTA
 */

type ActionCardProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  shortcut?: string;
  accent: "blue" | "violet" | "emerald";
  onClick: () => void;
};

const ACCENT_STYLES = {
  blue: {
    icon: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    ring: "hover:border-blue-300 hover:shadow-blue-500/10 dark:hover:border-blue-700",
  },
  violet: {
    icon: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    ring: "hover:border-violet-300 hover:shadow-violet-500/10 dark:hover:border-violet-700",
  },
  emerald: {
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    ring: "hover:border-emerald-300 hover:shadow-emerald-500/10 dark:hover:border-emerald-700",
  },
} as const;

function ActionCard({ icon, title, description, shortcut, accent, onClick }: ActionCardProps) {
  const styles = ACCENT_STYLES[accent];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-800",
        styles.ring
      )}
    >
      <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110", styles.icon)}>
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>
      </div>
      {shortcut && (
        <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400">
          {shortcut}
        </kbd>
      )}
    </button>
  );
}

/** Admin/oluşturma yetkili — 3 büyük CTA */
export function OnboardingEmpty({
  canCreateTask,
  canImportCsv,
  onCreateTask,
  onImportCsv,
}: {
  canCreateTask: boolean;
  canImportCsv: boolean;
  onCreateTask: () => void;
  onImportCsv: () => void;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto w-full max-w-4xl px-4 py-10"
    >
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/20">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Hızlı başlangıç
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">
          Boş tablo ile başla. Aşağıdaki üç yoldan biriyle ilk görevlerini ekleyebilirsin.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {canImportCsv && (
          <ActionCard
            icon={<Upload className="h-5 w-5" />}
            title="CSV içe aktar"
            description="Excel veya Google Sheets'ten 100+ satırı tek seferde yükle."
            accent="blue"
            onClick={onImportCsv}
          />
        )}
        <ActionCard
          icon={<Keyboard className="h-5 w-5" />}
          title="Komut paleti"
          description="Hızlıca oluştur, ara, gezin. Klavye odaklı iş akışı."
          shortcut="⌘K"
          accent="violet"
          onClick={() => openCommandPalette()}
        />
        {canCreateTask && (
          <ActionCard
            icon={<PlusCircle className="h-5 w-5" />}
            title="Manuel ekle"
            description="Tek görev ekle — tüm alanları kendin doldur."
            accent="emerald"
            onClick={onCreateTask}
          />
        )}
      </div>
    </motion.div>
  );
}

/** Üye yetkide — yumuşak mesaj */
export function NoCreatePermissionEmpty() {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <Sparkles className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        Henüz görev yok
      </h3>
      <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
        Bu tabloya görev eklenince burada listelenir. Yetki eklenmesi için yönetici ile iletişime geçebilirsin.
      </p>
    </div>
  );
}

/** Aktif filtreler chip listesi + temizle CTA */
export function FilteredEmpty({
  searchValue,
  columnFilters,
  projectFilter,
  projectFilterOptions,
  onClearAll,
}: {
  searchValue?: string;
  columnFilters: Record<string, string[]>;
  projectFilter?: string[];
  projectFilterOptions?: { id: string; name: string }[];
  onClearAll: () => void;
}) {
  const reduced = useReducedMotion();
  // Aktif filtreleri chip dizisine indirge
  const chips: Array<{ key: string; label: string }> = [];
  if (searchValue && searchValue.trim()) {
    chips.push({ key: "search", label: `Arama: "${searchValue.trim()}"` });
  }
  if (projectFilter && projectFilter.length > 0 && projectFilterOptions) {
    const names = projectFilter
      .map((id) => projectFilterOptions.find((p) => p.id === id)?.name)
      .filter(Boolean) as string[];
    if (names.length > 0) {
      chips.push({
        key: "project",
        label: `Proje: ${names.length === 1 ? names[0] : `${names.length} proje`}`,
      });
    }
  }
  for (const [col, values] of Object.entries(columnFilters ?? {})) {
    if (!values || values.length === 0) continue;
    chips.push({ key: `col-${col}`, label: `${col}: ${values.length} değer` });
  }

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mx-auto max-w-2xl px-4 py-10 text-center"
    >
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
        <Search className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        Bu filtrelerle eşleşen görev yok
      </h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {chips.length === 1
          ? "Aktif filtreyi kaldırarak tüm görevleri görebilirsin."
          : `${chips.length} aktif filtre var — birini veya hepsini kaldırarak tekrar dene.`}
      </p>
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          {chips.slice(0, 6).map((c) => (
            <span
              key={c.key}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <Filter className="h-3 w-3" aria-hidden />
              {c.label}
            </span>
          ))}
          {chips.length > 6 && (
            <span className="text-xs text-slate-500">+{chips.length - 6}</span>
          )}
        </div>
      )}
      <div className="mt-5">
        <Button type="button" variant="outline" size="sm" onClick={onClearAll}>
          <X className="mr-1.5 h-4 w-4" />
          Tüm filtreleri temizle
        </Button>
      </div>
    </motion.div>
  );
}
