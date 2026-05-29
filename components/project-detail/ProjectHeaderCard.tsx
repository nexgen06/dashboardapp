"use client";

import { ShieldCheck, Users } from "lucide-react";
import type { ProjectStatus } from "@/types/project";
import type { OnlineUser } from "@/hooks/usePresence";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProjectActionButtons } from "@/components/project-detail/ProjectActionButtons";
import { cn } from "@/lib/utils";
import { useProfileLookup } from "@/contexts/profile-lookup-context";

const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  Aktif: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  Tamamlandı: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  Beklemede: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
};

const VISIBLE_ASSIGNEE_CHIPS = 3;

function emailInitials(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.slice(0, 2).toUpperCase();
}

export type ProjectHeaderCardProps = {
  name: string;
  description?: string | null;
  status: ProjectStatus;
  dateLabel: string;
  assignedEmails: string[];
  currentUserEmail: string;
  isAssigned?: boolean;
  onlineUsers: OnlineUser[];
  liveTableHref: string;
  editHref?: string;
  canEdit?: boolean;
  canManageMembers?: boolean;
  onMemberPermissions?: () => void;
};

export function ProjectHeaderCard({
  name,
  description,
  status,
  dateLabel,
  assignedEmails,
  currentUserEmail,
  isAssigned = false,
  onlineUsers,
  liveTableHref,
  editHref,
  canEdit,
  canManageMembers,
  onMemberPermissions,
}: ProjectHeaderCardProps) {
  const profileLookup = useProfileLookup();
  const visibleAssignees = assignedEmails.slice(0, VISIBLE_ASSIGNEE_CHIPS);
  const hiddenAssigneeCount = Math.max(0, assignedEmails.length - VISIBLE_ASSIGNEE_CHIPS);
  const summaryText =
    (description ?? "").trim() ||
    "Proje görevleri, canlı tablo ve ekip çalışması için yönetim alanı.";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6 dark:border-slate-700 dark:bg-slate-900/30">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0 space-y-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              {name || "İsimsiz proje"}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("text-xs font-medium", PROJECT_STATUS_STYLES[status])}>
                {status}
              </Badge>
              <span className="text-sm text-slate-500 dark:text-slate-400">{dateLabel}</span>
              {isAssigned && (
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 text-xs font-normal text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  Atandınız
                </Badge>
              )}
            </div>
          </div>

          <p className="max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {summaryText}
          </p>

          {assignedEmails.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Atanan kullanıcılar
              </p>
              <div className="flex flex-wrap gap-1.5">
                {visibleAssignees.map((email) => (
                  <span
                    key={email}
                    className={cn(
                      "inline-flex max-w-full truncate rounded-full border px-2.5 py-1 text-xs",
                      email.toLowerCase() === currentUserEmail
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    )}
                    title={email}
                  >
                    {email}
                  </span>
                ))}
                {hiddenAssigneeCount > 0 && (
                  <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    +{hiddenAssigneeCount} daha
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
              <div className="flex -space-x-1.5">
                {onlineUsers.length > 0 ? (
                  onlineUsers.slice(0, 3).map((u, idx) => {
                    const profile = profileLookup.byEmail(u.email);
                    return (
                      <Avatar
                        key={u.key ?? idx}
                        className="h-6 w-6 border-2 border-white dark:border-slate-800"
                      >
                        {profile.avatarUrl ? <AvatarImage src={profile.avatarUrl} alt="" /> : null}
                        <AvatarFallback className="bg-orange-100 text-[9px] text-orange-800 dark:bg-orange-950/60 dark:text-orange-200">
                          {emailInitials(u.email ?? u.name ?? "?")}
                        </AvatarFallback>
                      </Avatar>
                    );
                  })
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-slate-500 dark:border-slate-800 dark:bg-slate-700 dark:text-slate-400">
                    <Users className="h-3 w-3" />
                  </span>
                )}
              </div>
              <span className="font-medium">Aktif ekip · {onlineUsers.length}</span>
            </div>
          </div>
        </div>

        <ProjectActionButtons
          liveTableHref={liveTableHref}
          editHref={editHref}
          canEdit={canEdit}
          canManageMembers={canManageMembers}
          onMemberPermissions={onMemberPermissions}
          className="lg:min-w-[15rem] lg:flex-col lg:items-stretch xl:min-w-[17rem]"
          layout="stack"
        />
      </div>
    </section>
  );
}
