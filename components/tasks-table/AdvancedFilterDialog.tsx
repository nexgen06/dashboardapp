"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ADVANCED_FILTER_OP_OPTIONS,
  generateAdvancedFilterRuleId,
  type AdvancedFilterRule,
} from "@/lib/liveTableAdvancedFilters";
import { cn } from "@/lib/utils";

export type AdvancedFilterFieldOption = { id: string; label: string };

export function AdvancedFilterDialog({
  open,
  onOpenChange,
  rules,
  onRulesChange,
  fieldOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rules: AdvancedFilterRule[];
  onRulesChange: React.Dispatch<React.SetStateAction<AdvancedFilterRule[]>>;
  fieldOptions: AdvancedFilterFieldOption[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,40rem)] max-w-lg overflow-y-auto border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
        <DialogHeader>
          <DialogTitle>Gelişmiş filtre</DialogTitle>
          <DialogDescription className="text-slate-600 dark:text-slate-400">
            Kuralların hepsi birlikte uygulanır (hepsi doğru olmalı — VE). Tablo yapısı değişse de aynı pencereden ek
            sütunları seçebilirsiniz.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-blue-200 bg-blue-50/60 px-3 py-2 text-ui-caption text-blue-900 dark:border-blue-700/60 dark:bg-blue-950/40 dark:text-blue-100">
          <strong>İpucu:</strong> Tek bir kural eklediğinizde tablo o alana göre <em>otomatik A-Z</em> sıralanır; aynı
          değere sahip satırlar yan yana gelir. Manuel değiştirmek için sütun başlığına tıklayabilirsiniz.
        </div>
        <div className="space-y-3 py-1">
          {rules.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Henüz kural yok. Aşağıdan «Kural ekle» ile koşul ekleyin.
            </p>
          )}
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-600 dark:bg-slate-900/40 sm:flex-row sm:flex-wrap sm:items-end"
            >
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                <div className="min-w-0">
                  <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Alan</span>
                  <select
                    value={rule.field}
                    onChange={(e) =>
                      onRulesChange((prev) =>
                        prev.map((r) => (r.id === rule.id ? { ...r, field: e.target.value } : r))
                      )
                    }
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {fieldOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0">
                  <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Koşul</span>
                  <select
                    value={rule.op}
                    onChange={(e) =>
                      onRulesChange((prev) =>
                        prev.map((r) =>
                          r.id === rule.id ? { ...r, op: e.target.value as AdvancedFilterRule["op"] } : r
                        )
                      )
                    }
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {ADVANCED_FILTER_OP_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div
                  className={cn(
                    "min-w-0 sm:col-span-2",
                    (rule.op === "is_empty" || rule.op === "is_not_empty") && "opacity-60"
                  )}
                >
                  <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Değer</span>
                  <input
                    type="text"
                    disabled={rule.op === "is_empty" || rule.op === "is_not_empty"}
                    value={rule.value}
                    onChange={(e) =>
                      onRulesChange((prev) =>
                        prev.map((r) => (r.id === rule.id ? { ...r, value: e.target.value } : r))
                      )
                    }
                    placeholder="Metin (büyük/küçük harf duyarsız)"
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                onClick={() => onRulesChange((prev) => prev.filter((r) => r.id !== rule.id))}
                aria-label="Kuralı sil"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onRulesChange((prev) => [
                ...prev,
                {
                  id: generateAdvancedFilterRuleId(),
                  field: fieldOptions[0]?.id ?? "content",
                  op: "contains",
                  value: "",
                },
              ])
            }
          >
            <Plus className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
            Kural ekle
          </Button>
          {rules.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={() => onRulesChange([])}
            >
              Tüm kuralları sil
            </Button>
          )}
        </div>
        <DialogFooter className="sm:justify-end">
          <Button
            type="button"
            className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
            onClick={() => onOpenChange(false)}
          >
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
