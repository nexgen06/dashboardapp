/**
 * Proje CSV/JSON içe aktarımında atanan e-posta sütununu bulma ve normalleştirme.
 */

/** Boş veya geçerli e-posta döner; aksi halde null */
export function normalizeTaskAssigneeEmail(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return s;
  return null;
}

/** CSV/Excel başlık indeksini bulur (Atanan / assignee / …) */
export function findAssigneeColumnIndex(headers: string[]): number | null {
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] ?? "").trim().toLowerCase();
    if (!h) continue;
    if (h === "atanan" || h === "assignee" || h === "assigned" || h === "e-posta" || h === "e-posta adresi")
      return i;
    if (h === "email" || h === "e-mail" || h === "mail") return i;
    if (h.includes("atanan")) return i;
    if (h.includes("assignee")) return i;
  }
  return null;
}

/** JSON satırı için atanan anahtarı (ilk eşleşen başlık) */
export function findAssigneeJsonKey(headers: string[]): string | null {
  const idx = findAssigneeColumnIndex(headers);
  if (idx == null) return null;
  const key = (headers[idx] ?? "").trim() || `Sütun`;
  return key;
}

export function pickRoundRobinAssignee(
  recipients: string[],
  index: number
): string | null {
  const list = recipients.map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (list.length === 0) return null;
  return list[index % list.length];
}
