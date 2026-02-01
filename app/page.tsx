"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { DashboardSection } from "@/components/DashboardSection";

export default function HomePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canProjects = hasPermission("area.projects");
  const canLiveTable = hasPermission("area.liveTable");

  const tabParam = searchParams?.get("tab") ?? null;

  // Redirect legacy tab URLs to dedicated pages
  useEffect(() => {
    if (tabParam === "projeler" && canProjects) {
      router.replace("/projeler");
    } else if (tabParam === "canli-tablo" && canLiveTable) {
      router.replace("/canli-tablo");
    }
  }, [tabParam, canProjects, canLiveTable, router]);

  return (
    <div className="container max-w-6xl">
      <DashboardSection />
    </div>
  );
}
