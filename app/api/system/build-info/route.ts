import { NextResponse } from "next/server";
import type { SystemBuildInfo } from "@/lib/systemAdminHealth";

export const dynamic = "force-dynamic";

function firstEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

export async function GET() {
  const payload: SystemBuildInfo = {
    version: firstEnv("NEXT_PUBLIC_APP_VERSION") || "0.1.0",
    commit: firstEnv(
      "NEXT_PUBLIC_GIT_SHA",
      "NEXT_PUBLIC_RAILWAY_GIT_COMMIT_SHA",
      "RAILWAY_GIT_COMMIT_SHA"
    ),
    deployment: firstEnv(
      "NEXT_PUBLIC_RAILWAY_DEPLOYMENT_ID",
      "RAILWAY_DEPLOYMENT_ID",
      "RAILWAY_REPLICA_ID"
    ),
    environment: firstEnv("NEXT_PUBLIC_APP_ENV", "RAILWAY_ENVIRONMENT_NAME", "NODE_ENV") || "unknown",
    realtimeDisabled: firstEnv("NEXT_PUBLIC_DISABLE_REALTIME").toLowerCase() === "true",
  };

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
