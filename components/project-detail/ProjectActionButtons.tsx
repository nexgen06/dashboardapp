"use client";

import Link from "next/link";
import { ArrowRight, Pencil, ShieldCheck, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ProjectActionButtonsProps = {
  liveTableHref: string;
  editHref?: string;
  canEdit?: boolean;
  canManageMembers?: boolean;
  onMemberPermissions?: () => void;
  className?: string;
  layout?: "stack" | "row";
};

export function ProjectActionButtons({
  liveTableHref,
  editHref,
  canEdit = false,
  canManageMembers = false,
  onMemberPermissions,
  className,
  layout = "row",
}: ProjectActionButtonsProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center",
        layout === "stack" && "w-full sm:flex-col sm:items-stretch",
        className
      )}
    >
      {canManageMembers && onMemberPermissions && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onMemberPermissions}
          className="h-9 gap-1.5 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Üye izinleri
        </Button>
      )}
      {canEdit && editHref && (
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <Link href={editHref}>
            <Pencil className="h-4 w-4" aria-hidden />
            Düzenle
          </Link>
        </Button>
      )}
      <Button
        asChild
        size="sm"
        className="h-9 gap-1.5 bg-orange-600 text-white shadow-sm hover:bg-orange-700"
      >
        <Link href={liveTableHref}>
          <Table2 className="h-4 w-4" aria-hidden />
          Canlı Tabloda Aç
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </Button>
    </div>
  );
}
