const DEFAULT_EXTRA_KEY_ORDER = [
  "Başlık",
  "Görev",
  "Ad",
  "İsim",
  "Title",
  "Name",
  "Açıklama",
  "Description",
];

/** CSV içe aktarımda `content` boş kalabilir; özet satırlarında hangi `extra_data` anahtarının başlık sayılacağı. */
export function getTaskDisplayLabel(
  task: {
    content?: string | null;
    extra_data?: Record<string, string> | null;
  },
  preferredExtraKeys?: string[]
): string {
  const c = (task.content ?? "").trim();
  if (c) return c;
  const ed = task.extra_data;
  if (!ed || typeof ed !== "object") return "—";

  const orderedKeys = [
    ...(preferredExtraKeys ?? []).map((k) => k.trim()).filter(Boolean),
    ...DEFAULT_EXTRA_KEY_ORDER,
  ];
  const tried = new Set<string>();
  for (const k of orderedKeys) {
    const norm = k.toLowerCase();
    if (tried.has(norm)) continue;
    tried.add(norm);
    const v = ed[k] ?? ed[k.charAt(0).toUpperCase() + k.slice(1)] ?? ed[norm] ?? ed[k.toUpperCase()];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  const first = Object.values(ed).find((v) => v != null && String(v).trim() !== "");
  return first != null ? String(first).trim() : "—";
}
