"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { DashboardSection } from "@/components/DashboardSection";

export default function HomePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { hasPermission, isLoaded } = useAuth();
  const canProjects = hasPermission("area.projects");
  const canLiveTable = hasPermission("area.liveTable");

  const tabParam = searchParams?.get("tab") ?? null;

  // Legacy ?tab=… adresleri: yetki varsa ilgili sayfaya; yoksa sorguyu kaldırarak / bırak
  useEffect(() => {
    if (!isLoaded) return;
    if (tabParam === "projeler" && canProjects) {
      router.replace("/projeler");
      return;
    }
    if (tabParam === "canli-tablo" && canLiveTable) {
      router.replace("/canli-tablo");
      return;
    }
    if (tabParam === "projeler" || tabParam === "canli-tablo") {
      router.replace("/");
    }
  }, [isLoaded, tabParam, canProjects, canLiveTable, router]);

  return (
    <div className="container max-w-6xl">
      <DashboardSection />
    </div>
  );
}
