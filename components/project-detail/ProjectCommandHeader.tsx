"use client";

import { ProjectHeaderCard } from "@/components/project-detail/ProjectHeaderCard";
import { ProjectKpiGrid } from "@/components/project-detail/ProjectKpiGrid";
import { ProjectTabs } from "@/components/project-detail/ProjectTabs";
import {
  computeProjectHealth,
  type ProjectKpiSnapshot,
} from "@/lib/projectHealth";
import type { ProjectDetailTab } from "@/components/project-detail/projectDetailTypes";
import type { ProjectPriority, ProjectStatus } from "@/types/project";
import type { DateFormat } from "@/contexts/settings-context";
import type { OnlineUser } from "@/hooks/usePresence";

export type ProjectCommandHeaderProps = {
  name: string;
  description?: string | null;
  status: ProjectStatus;
  dateLabel: string;
  targetDueDate?: string | null;
  priority?: ProjectPriority | null;
  dateFormat?: DateFormat;
  assignedEmails: string[];
  currentUserEmail: string;
  isAssigned?: boolean;
  onlineUsers: OnlineUser[];
  kpis: ProjectKpiSnapshot;
  liveTableHref: string;
  editHref?: string;
  canEdit?: boolean;
  canManageMembers?: boolean;
  onMemberPermissions?: () => void;
  activeTab: ProjectDetailTab;
  onTabChange: (tab: ProjectDetailTab) => void;
};

export function ProjectCommandHeader({
  name,
  description,
  status,
  dateLabel,
  targetDueDate,
  priority,
  dateFormat,
  assignedEmails,
  currentUserEmail,
  isAssigned,
  onlineUsers,
  kpis,
  liveTableHref,
  editHref,
  canEdit,
  canManageMembers,
  onMemberPermissions,
  activeTab,
  onTabChange,
}: ProjectCommandHeaderProps) {
  const health = computeProjectHealth(kpis);

  return (
    <div className="space-y-4">
      <ProjectHeaderCard
        name={name}
        description={description}
        status={status}
        dateLabel={dateLabel}
        targetDueDate={targetDueDate}
        priority={priority}
        dateFormat={dateFormat}
        assignedEmails={assignedEmails}
        currentUserEmail={currentUserEmail}
        isAssigned={isAssigned}
        onlineUsers={onlineUsers}
        liveTableHref={liveTableHref}
        editHref={editHref}
        canEdit={canEdit}
        canManageMembers={canManageMembers}
        onMemberPermissions={onMemberPermissions}
      />
      <ProjectKpiGrid kpis={kpis} />
      <ProjectTabs activeTab={activeTab} onTabChange={onTabChange} health={health} kpis={kpis} />
    </div>
  );
}
