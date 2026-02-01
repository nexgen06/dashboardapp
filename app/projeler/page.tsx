"use client";

import { useAuth } from "@/contexts/auth-context";
import { ProjectsSection } from "@/components/ProjectsSection";
import { Shield } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ProjelerPage() {
  const { hasPermission } = useAuth();
  const canProjects = hasPermission("area.projects");

  if (!canProjects) {
    return (
      <div className="container max-w-2xl py-16">
        <div className="rounded-lg border-2 border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-8 text-center">
          <Shield className="h-12 w-12 mx-auto text-amber-600 dark:text-amber-400 mb-3" />
          <p className="text-slate-800 dark:text-slate-200 font-medium">Projelere erişim yetkiniz yok.</p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Bu alan için yetki gerekir.</p>
          <Button variant="outline" asChild className="mt-4">
            <Link href="/">Dashboard&apos;a dön</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl py-6">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
            Projeler
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Projelerinizi listeleyin, arayın ve filtreleyin. Yeni proje ekleyin veya bir projeye tıklayarak görevlere gidin.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <Link href="/">Dashboard&apos;a dön</Link>
        </Button>
      </header>
      <ProjectsSection variant="page" />
    </div>
  );
}
