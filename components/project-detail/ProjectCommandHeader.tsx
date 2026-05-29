"use client";

import { ProjectHeaderCard } from "@/components/project-detail/ProjectHeaderCard";
import { ProjectKpiGrid } from "@/components/project-detail/ProjectKpiGrid";
import { ProjectTabs } from "@/components/project-detail/ProjectTabs";
import {
  computeProjectHealth,
  type ProjectDetailTab,
  type ProjectKpiSnapshot,
} from "@/components/project-detail/projectDetailTypes";
import type { ProjectStatus } from "@/types/project";
import type { OnlineUser } from "@/hooks/usePresence";

export type ProjectCommandHeaderProps = {
  name: string;
  description?: string | null;
  status: ProjectStatus;
  dateLabel: string;
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
      <ProjectTabs activeTab={activeTab} onTabChange={onTabChange} health={health} />
    </div>
  );
}
