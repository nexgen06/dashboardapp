export type ProjectHealthStatus = "İyi" | "Orta" | "Dikkat";

export type ProjectKpiSnapshot = {
  total: number;
  done: number;
  completionPct: number;
  overdue: number;
  dueToday: number;
  unassigned: number;
};

export type ProjectHealthExplanation = {
  status: ProjectHealthStatus;
  reasons: string[];
  positives: string[];
};

export function computeProjectHealth(kpis: ProjectKpiSnapshot): ProjectHealthStatus {
  if (kpis.overdue >= 5) return "Dikkat";
  if (kpis.overdue > 0 || kpis.dueToday >= 8) return "Orta";
  if (kpis.total > 0 && kpis.unassigned / kpis.total > 0.25) return "Orta";
  return "İyi";
}

/** Proje sağlığı rozetinin arkasındaki metrikleri kullanıcı dilinde açıklar. */
export function explainProjectHealth(kpis: ProjectKpiSnapshot): ProjectHealthExplanation {
  const status = computeProjectHealth(kpis);
  const reasons: string[] = [];
  const positives: string[] = [];

  if (kpis.overdue >= 5) {
    reasons.push(`${kpis.overdue} gecikmiş açık görev (5+ eşiği aşıldı)`);
  } else if (kpis.overdue > 0) {
    reasons.push(`${kpis.overdue} gecikmiş açık görev`);
  }

  if (kpis.dueToday >= 8) {
    reasons.push(`${kpis.dueToday} görev bugün son tarihli (8+ eşiği aşıldı)`);
  } else if (kpis.dueToday > 0 && status !== "İyi") {
    reasons.push(`${kpis.dueToday} görev bugün son tarihli`);
  }

  if (kpis.total > 0) {
    const unassignedPct = Math.round((kpis.unassigned / kpis.total) * 100);
    if (unassignedPct > 25) {
      reasons.push(`Görevlerin %${unassignedPct}'i atanmamış (%25 eşiği aşıldı)`);
    }
  }

  if (status === "İyi") {
    if (kpis.overdue === 0) positives.push("Gecikmiş açık görev yok");
    if (kpis.total === 0) {
      positives.push("Henüz görev yok — sağlık nötr");
    } else {
      positives.push(`Tamamlanma oranı: %${kpis.completionPct}`);
      const unassignedPct = Math.round((kpis.unassigned / kpis.total) * 100);
      if (unassignedPct <= 25) {
        positives.push(`Atanmamış görev oranı: %${unassignedPct}`);
      }
      if (kpis.dueToday > 0 && kpis.dueToday < 8) {
        positives.push(`${kpis.dueToday} görev bugün son tarihli`);
      }
    }
  } else if (status === "Orta" && kpis.completionPct >= 50) {
    positives.push(`Tamamlanma oranı: %${kpis.completionPct}`);
  }

  return { status, reasons, positives };
}

export const PROJECT_HEALTH_STYLES: Record<
  ProjectHealthStatus,
  { badge: string; dot: string }
> = {
  İyi: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    dot: "bg-emerald-500 dark:bg-emerald-400",
  },
  Orta: {
    badge: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    dot: "bg-amber-500 dark:bg-amber-400",
  },
  Dikkat: {
    badge: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
    dot: "bg-red-500 dark:bg-red-400",
  },
};
