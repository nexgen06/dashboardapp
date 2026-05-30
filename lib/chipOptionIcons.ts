import type { ChipOption } from "@/lib/chipSystem";

/** Durum sütunu ile aynı ikon dili — etiket/value'dan yedek tahmin. */
export function inferChipOptionIconSlug(option: Pick<ChipOption, "label" | "value">): string | null {
  const value = option.value.trim().toLocaleLowerCase("tr");
  const label = option.label.trim().toLocaleLowerCase("tr");
  const text = `${value} ${label}`;

  if (value === "failed" || /gönderilemedi|gonderilemedi|bounce|başarısız|basarisiz/.test(text)) {
    return "x-circle";
  }
  if (value === "not_sent" || /gönderilmedi|gonderilmedi/.test(text)) {
    return "circle";
  }
  if (value === "pending" || /bekliyor|kuyruk|pending/.test(text)) {
    return "clock";
  }
  if (
    value === "sent" ||
    /^mail[_-]?(g[oö]nderildi|sent)$/.test(value) ||
    ((/gönderildi|gonderildi|mail gönderildi|mail gonderildi/.test(text)) &&
      !/gönderilemedi|gonderilemedi/.test(text))
  ) {
    return "check";
  }
  return null;
}

export function inferChipOptionColor(option: Pick<ChipOption, "label" | "value">): string {
  const slug = inferChipOptionIconSlug(option);
  if (slug === "check") return "emerald";
  if (slug === "x-circle") return "red";
  if (slug === "clock") return "amber";
  return "slate";
}
