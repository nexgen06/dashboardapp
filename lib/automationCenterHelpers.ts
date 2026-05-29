import type {
  AutomationActionType,
  AutomationCondition,
  AutomationConditionOperator,
} from "@/lib/automationRules";

export type DraftCondition = AutomationCondition & { id: string };

export const operators: Array<{ value: AutomationConditionOperator; label: string; needsValue?: boolean }> = [
  { value: "date_before_today", label: "tarih geçti" },
  { value: "date_today", label: "bugün" },
  { value: "status_not_done", label: "durum tamamlanmadı" },
  { value: "equals", label: "eşit", needsValue: true },
  { value: "not_equals", label: "eşit değil", needsValue: true },
  { value: "is_empty", label: "boş" },
  { value: "is_not_empty", label: "dolu" },
  { value: "updated_before_days", label: "X gündür güncellenmedi", needsValue: true },
  { value: "number_gt", label: "büyük", needsValue: true },
  { value: "number_lt", label: "küçük", needsValue: true },
];

export const actionTypes: Array<{ value: AutomationActionType; label: string; description: string }> = [
  { value: "assign_chip", label: "Çip ata", description: "Seçilen merkezi çip değerini satıra uygular." },
  { value: "set_risk", label: "Risk değiştir", description: "Risk şablonunu hızlı günceller." },
  { value: "color_row", label: "Satırı renklendir", description: "Eşleşen satırın tablo üzerinde dikkat çekmesini sağlar." },
  { value: "lock_row", label: "Satırı kilitle", description: "Eşleşen satırı ekip üyeleri için düzenlemeye kapatır." },
  { value: "notify", label: "Bildirim gönder", description: "Yönetici, proje yetkilileri ve atanmış kullanıcı için merkezi bildirim oluşturur." },
  { value: "log_only", label: "Sadece logla", description: "Kuralı test/izleme amacıyla saklar." },
];

export const rowColorOptions = [
  { value: "red", label: "Kırmızı" },
  { value: "amber", label: "Sarı" },
  { value: "emerald", label: "Yeşil" },
  { value: "blue", label: "Mavi" },
  { value: "purple", label: "Mor" },
  { value: "slate", label: "Gri" },
] as const;

export type DraftAction = {
  id: string;
  actionType: AutomationActionType;
  templateName: string;
  optionValue: string;
  rowColor: string;
  spotlightEnabled: boolean;
  spotlightColumn: string;
  spotlightValues: string;
  spotlightStartsAt: string;
  spotlightEndsAt: string;
  title: string;
  body: string;
};

export function draftId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function toDatetimeLocalInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  const hh = `${d.getHours()}`.padStart(2, "0");
  const min = `${d.getMinutes()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function defaultCondition(overrides?: Partial<AutomationCondition>): DraftCondition {
  return {
    id: draftId("condition"),
    field: overrides?.field ?? "due_date",
    op: overrides?.op ?? "date_before_today",
    value: overrides?.value ?? "",
  };
}

export function defaultAction(overrides?: Partial<DraftAction>): DraftAction {
  return {
    id: draftId("action"),
    actionType: overrides?.actionType ?? "set_risk",
    templateName: overrides?.templateName ?? "Risk",
    optionValue: overrides?.optionValue ?? "critical",
    rowColor: overrides?.rowColor ?? "red",
    spotlightEnabled: overrides?.spotlightEnabled ?? false,
    spotlightColumn: overrides?.spotlightColumn ?? "",
    spotlightValues: overrides?.spotlightValues ?? "",
    spotlightStartsAt: overrides?.spotlightStartsAt ?? "",
    spotlightEndsAt: overrides?.spotlightEndsAt ?? "",
    title: overrides?.title ?? "Otomasyon bildirimi",
    body: overrides?.body ?? "",
  };
}

export function operatorLabel(op: AutomationConditionOperator): string {
  return operators.find((item) => item.value === op)?.label ?? op;
}

export function actionLabel(action: { actionType: AutomationActionType; payload: Record<string, unknown> }): string {
  if (action.actionType === "assign_chip" || action.actionType === "set_risk") {
    return `${String(action.payload.templateName ?? "Çip")} = ${String(action.payload.optionValue ?? action.payload.optionLabel ?? "—")}`;
  }
  if (action.actionType === "notify") return `Bildirim: ${String(action.payload.title ?? "Otomasyon bildirimi")}`;
  if (action.actionType === "color_row") {
    const spotlight = Boolean(action.payload.spotlight);
    const column = String(action.payload.spotlightColumn ?? "").trim();
    const values = Array.isArray(action.payload.spotlightValues)
      ? action.payload.spotlightValues.map((item) => String(item)).filter(Boolean)
      : [];
    const startsAtRaw = String(action.payload.spotlightStartsAt ?? "").trim();
    const endsAtRaw = String(action.payload.spotlightEndsAt ?? "").trim();
    if (spotlight && column && values.length > 0) {
      const parts = [
        `Spotlight: ${column} → ${values.join(", ")}`,
        startsAtRaw ? `başlangıç: ${startsAtRaw}` : null,
        endsAtRaw ? `bitiş: ${endsAtRaw}` : null,
      ].filter(Boolean);
      return parts.join(" · ");
    }
    return `Satır rengi: ${String(action.payload.rowColor ?? action.payload.color ?? "—")}`;
  }
  if (action.actionType === "lock_row") return `Satır kilidi: ${String(action.payload.body ?? action.payload.reason ?? "Otomasyon kilidi")}`;
  if (action.actionType === "log_only") return "Sadece logla";
  return action.actionType;
}
