"use client";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Layers,
  UserX,
} from "lucide-react";
import { ProjectKpiCard } from "@/components/project-detail/ProjectKpiCard";
import type { ProjectKpiSnapshot } from "@/components/project-detail/projectDetailTypes";

export function ProjectKpiGrid({ kpis }: { kpis: ProjectKpiSnapshot }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
      <ProjectKpiCard
        label="Toplam"
        value={kpis.total}
        hint="Projedeki toplam görev"
        icon={Layers}
      />
      <ProjectKpiCard
        label="Tamamlanma"
        value={`%${kpis.completionPct}`}
        hint={`${kpis.done} / ${kpis.total} görev tamamlandı`}
        icon={CheckCircle2}
        variant="success"
        progressPct={kpis.completionPct}
        className="lg:col-span-1"
      />
      <ProjectKpiCard
        label="Gecikmiş"
        value={kpis.overdue}
        hint={kpis.overdue > 0 ? "Acil müdahale gerekebilir" : "Kritik gecikme yok"}
        icon={AlertTriangle}
        variant={kpis.overdue > 0 ? "danger" : "default"}
      />
      <ProjectKpiCard
        label="Bugün biten"
        value={kpis.dueToday}
        hint={
          kpis.dueToday > 0
            ? `${kpis.dueToday} görev bugün tamamlanmalı`
            : "Bugün tamamlanacak görev yok"
        }
        icon={CalendarDays}
        variant={kpis.dueToday > 0 ? "warning" : "default"}
      />
      <ProjectKpiCard
        label="Atanmamış"
        value={kpis.unassigned}
        hint={kpis.unassigned > 0 ? "Atama bekleyen görevler var" : "Atama bekleyen görev yok"}
        icon={UserX}
        variant={kpis.unassigned > 0 ? "warning" : "default"}
      />
    </div>
  );
}
