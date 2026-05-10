/** CSV/import ile gelen görevlerde `content` boş olabilir; liste ve özetlerde `extra_data`'dan okunur metin. */
export function getTaskDisplayLabel(task: {
  content?: string | null;
  extra_data?: Record<string, string> | null;
}): string {
  const c = (task.content ?? "").trim();
  if (c) return c;
  const ed = task.extra_data;
  if (!ed || typeof ed !== "object") return "—";
  const preferKeys = ["Başlık", "Görev", "Ad", "İsim", "Title", "Name", "Açıklama", "Description"];
  for (const k of preferKeys) {
    const v = ed[k] ?? ed[k.toLowerCase()];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  const first = Object.values(ed).find((v) => v != null && String(v).trim() !== "");
  return first != null ? String(first).trim() : "—";
}
