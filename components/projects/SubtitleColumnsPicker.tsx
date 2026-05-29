"use client";

export type SubtitleColumnsPickerProps = {
  availableKeys: string[];
  titleColumn: string;
  value: string[];
  onChange: (next: string[]) => void;
};

/**
 * Alt başlık sütunları seçici — kart başlığının altında küçük gri satırda gösterilecek
 * en fazla 3 anahtar. Başlık sütunuyla aynı olan adaylar listelenmez.
 */
export function SubtitleColumnsPicker({
  availableKeys,
  titleColumn,
  value,
  onChange,
}: SubtitleColumnsPickerProps) {
  const titleNorm = titleColumn.trim().toLowerCase();
  const candidatePool = new Set<string>();
  for (const k of availableKeys) {
    if (!k) continue;
    if (titleNorm && k.trim().toLowerCase() === titleNorm) continue;
    candidatePool.add(k);
  }
  for (const k of value) {
    if (k && (!titleNorm || k.trim().toLowerCase() !== titleNorm)) candidatePool.add(k);
  }
  const candidates = Array.from(candidatePool).sort((a, b) =>
    a.localeCompare(b, "tr", { sensitivity: "base" })
  );
  const toggle = (key: string) => {
    if (value.includes(key)) {
      onChange(value.filter((v) => v !== key));
      return;
    }
    if (value.length >= 3) return;
    onChange([...value, key]);
  };
  return (
    <div className="mt-3">
      <p className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
        Alt başlık sütunları (en fazla 3)
      </p>
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        Kart başlığının altında küçük gri satırda gösterilir — &quot;Ahmet Yılmaz · 12345 · Ankara&quot; gibi
        görevi ayırt etmeye yardım eder. Sıralama seçim sırasına göre.
      </p>
      {candidates.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs italic text-slate-500 dark:border-slate-600 dark:text-slate-400">
          Henüz sütun yok — önce &quot;Görev başlığı sütunu&quot; için liste oluşsun.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {candidates.map((k) => {
            const selected = value.includes(k);
            const order = selected ? value.indexOf(k) + 1 : 0;
            const disabled = !selected && value.length >= 3;
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggle(k)}
                disabled={disabled}
                className={
                  selected
                    ? "inline-flex items-center gap-1 rounded-full border border-blue-500 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-400 dark:bg-blue-900/40 dark:text-blue-200"
                    : disabled
                      ? "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-400 opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
                      : "inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-blue-950/30"
                }
              >
                {selected && (
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                    {order}
                  </span>
                )}
                {k}
              </button>
            );
          })}
        </div>
      )}
      {value.length > 0 && (
        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          Seçili: {value.join(" · ")} · {value.length}/3
        </p>
      )}
    </div>
  );
}
