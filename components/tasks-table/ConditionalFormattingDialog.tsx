"use client";

import { useState } from "react";
import { Plus, Trash2, RotateCcw, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CF_FIELDS,
  CF_OPERATORS,
  CF_STYLES,
  type CfRule,
  type CfField,
  type CfOperator,
  type CfStyleId,
} from "@/hooks/useConditionalFormatting";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rules: CfRule[];
  onToggle: (id: string) => void;
  onAdd: (rule: Omit<CfRule, "id">) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<CfRule>) => void;
  onReset: () => void;
};

const STYLE_KEYS = Object.keys(CF_STYLES) as CfStyleId[];

export function ConditionalFormattingDialog({
  open,
  onOpenChange,
  rules,
  onToggle,
  onAdd,
  onDelete,
  onUpdate,
  onReset,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Omit<CfRule, "id">>({
    name: "",
    enabled: true,
    field: "status",
    operator: "equals",
    value: "",
    style: "blue",
    bold: false,
  });

  const operatorsForField = (field: CfField) =>
    CF_OPERATORS.filter((op) => !op.fields || op.fields.includes(field));

  const resetDraft = () => {
    setDraft({
      name: "",
      enabled: true,
      field: "status",
      operator: "equals",
      value: "",
      style: "blue",
      bold: false,
    });
  };

  const handleAdd = () => {
    if (!draft.name.trim()) return;
    onAdd(draft);
    resetDraft();
    setAdding(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            Koşullu Biçimlendirme
          </DialogTitle>
          <DialogDescription>
            Kurala uyan satırlar otomatik renklendirilir (Excel pattern). İlk eşleşen kural kazanır.
          </DialogDescription>
        </DialogHeader>

        {/* Kural listesi */}
        <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {rules.length === 0 && (
            <p className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
              Henüz kural yok. Aşağıdan yeni kural ekle.
            </p>
          )}
          {rules.map((rule) => {
            const style = CF_STYLES[rule.style];
            return (
              <div
                key={rule.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800",
                  rule.enabled && "border-l-4",
                  rule.enabled && style.accentClass
                )}
              >
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={() => onToggle(rule.id)}
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  aria-label={rule.enabled ? "Kuralı kapat" : "Kuralı aç"}
                />
                <span className={cn("h-3 w-3 shrink-0 rounded-full", style.dotClass)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{rule.name}</p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {CF_FIELDS.find((f) => f.id === rule.field)?.label}
                    {" "}<span className="opacity-70">{CF_OPERATORS.find((o) => o.id === rule.operator)?.label}</span>
                    {rule.value && CF_OPERATORS.find((o) => o.id === rule.operator)?.valueNeeded && (
                      <> <span className="font-mono">&quot;{rule.value}&quot;</span></>
                    )}
                  </p>
                </div>
                <select
                  value={rule.style}
                  onChange={(e) => onUpdate(rule.id, { style: e.target.value as CfStyleId })}
                  className="h-7 rounded-md border border-slate-200 bg-white px-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  aria-label="Renk"
                >
                  {STYLE_KEYS.map((k) => (
                    <option key={k} value={k}>{CF_STYLES[k].label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onDelete(rule.id)}
                  className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                  aria-label="Sil"
                  title="Kuralı sil"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            );
          })}
        </div>

        {/* Yeni kural formu */}
        {adding ? (
          <div className="space-y-2 rounded-lg border-2 border-dashed border-violet-300 bg-violet-50/40 p-3 dark:border-violet-700 dark:bg-violet-950/20">
            <input
              type="text"
              placeholder="Kural adı (örn. Acil görevler)"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              autoFocus
            />
            <div className="grid gap-2 sm:grid-cols-3">
              <select
                value={draft.field}
                onChange={(e) => setDraft({ ...draft, field: e.target.value as CfField, operator: "equals" })}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {CF_FIELDS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
              <select
                value={draft.operator}
                onChange={(e) => setDraft({ ...draft, operator: e.target.value as CfOperator })}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {operatorsForField(draft.field).map((op) => <option key={op.id} value={op.id}>{op.label}</option>)}
              </select>
              {CF_OPERATORS.find((o) => o.id === draft.operator)?.valueNeeded ? (
                <input
                  type="text"
                  placeholder="Değer"
                  value={draft.value ?? ""}
                  onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              ) : (
                <div className="rounded-md border border-dashed border-slate-200 px-2 py-1.5 text-xs text-slate-400 dark:border-slate-600">
                  Değer gerekmez
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">Renk:</span>
                {STYLE_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setDraft({ ...draft, style: k })}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                      CF_STYLES[k].dotClass,
                      draft.style === k ? "border-slate-900 dark:border-white" : "border-transparent"
                    )}
                    aria-label={CF_STYLES[k].label}
                    title={CF_STYLES[k].label}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setAdding(false); resetDraft(); }}>
                  İptal
                </Button>
                <Button size="sm" onClick={handleAdd} disabled={!draft.name.trim()}>
                  Ekle
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)} className="w-full">
            <Plus className="mr-2 h-4 w-4" /> Yeni kural ekle
          </Button>
        )}

        <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <RotateCcw className="h-3 w-3" />
            Varsayılan preset&apos;lere dön
          </button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Kapat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
