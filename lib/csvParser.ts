/**
 * Basit CSV ayrıştırıcı. Tırnak içindeki virgül/noktalı virgül ve satır sonlarını destekler.
 * İlk satır başlık kabul edilir.
 * Ayırıcı: virgül (,) veya noktalı virgül (;) — ilk satıra göre otomatik seçilir (Türkiye/Excel genelde ; kullanır).
 */
function detectDelimiter(firstLine: string): "," | ";" {
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  return semicolonCount >= commaCount ? ";" : ",";
}

export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/^\uFEFF/, "");
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes) {
      if (c === "\n") {
        lines.push(current);
        current = "";
        continue;
      }
    }
    current += c;
  }
  if (current.length > 0) lines.push(current);

  if (lines.length === 0) return { headers: [], rows: [] };

  const delimiter = detectDelimiter(lines[0]);

  const parseRow = (row: string): string[] => {
    const out: string[] = [];
    let cell = "";
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && c === delimiter) {
        out.push(cell.trim());
        cell = "";
        continue;
      }
      cell += c;
    }
    out.push(cell.trim());
    return out;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map((line) => parseRow(line));
  return { headers, rows };
}
