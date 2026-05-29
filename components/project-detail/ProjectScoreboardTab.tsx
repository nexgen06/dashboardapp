"use client";

import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProjectScoreRow, ProjectScoreSummary } from "@/lib/projectScoreboard";

export type ProjectScoreboardTabProps = {
  scoreRows: ProjectScoreRow[];
  scoreSummary: ProjectScoreSummary;
  formatAssignee: (assignee: string) => string;
  onAssigneeClick?: (assignee: string) => void;
};

export function ProjectScoreboardTab({
  scoreRows,
  scoreSummary,
  formatAssignee,
  onAssigneeClick,
}: ProjectScoreboardTabProps) {
  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/40">
          <div className="text-xs text-slate-500 dark:text-slate-400">Ekip ortalama skoru</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            {scoreSummary.averageScore}
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 shadow-sm dark:border-amber-800 dark:bg-amber-950/30">
          <div className="text-xs text-amber-700 dark:text-amber-300">Lider</div>
          <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-100">
            <Trophy className="h-4 w-4" />
            {scoreSummary.leader ? formatAssignee(scoreSummary.leader.assignee) : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 shadow-sm dark:border-blue-800 dark:bg-blue-950/30">
          <div className="text-xs text-blue-700 dark:text-blue-300">Katılımcı</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-blue-900 dark:text-blue-100">
            {scoreSummary.teamCount}
          </div>
        </div>
      </div>

      {scoreRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
          Skor panosu için atanmış görev verisi bulunamadı.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/40">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/70">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2 font-medium">Sıra</th>
                <th className="px-3 py-2 font-medium">Kullanıcı</th>
                <th className="px-3 py-2 font-medium">Skor</th>
                <th className="px-3 py-2 font-medium">Tamamlanan</th>
                <th className="px-3 py-2 font-medium">Zamanında</th>
                <th className="px-3 py-2 font-medium">Geciken</th>
                <th className="px-3 py-2 font-medium">Yüksek öncelik bonus</th>
              </tr>
            </thead>
            <tbody>
              {scoreRows.map((row, idx) => (
                <tr
                  key={`${row.assignee}-${idx}`}
                  className={cn(
                    "border-t border-slate-100 dark:border-slate-700/70",
                    onAssigneeClick && "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  )}
                  onClick={onAssigneeClick ? () => onAssigneeClick(row.assignee) : undefined}
                  onKeyDown={
                    onAssigneeClick
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onAssigneeClick(row.assignee);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onAssigneeClick ? 0 : undefined}
                  role={onAssigneeClick ? "button" : undefined}
                  title={onAssigneeClick ? "Bu kişinin görevlerini gör" : undefined}
                >
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400">#{idx + 1}</td>
                  <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">
                    {formatAssignee(row.assignee)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-semibold",
                        row.score >= scoreSummary.averageScore
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      )}
                    >
                      {row.score}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-700 dark:text-slate-200">{row.done}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-700 dark:text-slate-200">{row.onTimeDone}</td>
                  <td className="px-3 py-2 tabular-nums text-red-700 dark:text-red-300">{row.overdueOpen}</td>
                  <td className="px-3 py-2 tabular-nums text-blue-700 dark:text-blue-300">+{row.highDone * 2}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Formül: Tamamlanan*10 + Zamanında*6 + Yüksek Öncelik*2 - Geciken*4
        {onAssigneeClick && " · Satıra tıklayarak o kişinin görevlerine gidebilirsiniz."}
      </p>
    </>
  );
}
