import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Gecikmiş görev bildirimlerini üretir (Bildirimler Faz 2).
 *
 * Yetkilendirme: Authorization: Bearer ${CRON_SECRET}
 * Vercel Cron: CRON_SECRET ortam değişkeni tanımlı olmalı.
 *
 * Alternatif: Supabase pg_cron ile doğrudan
 *   select public.refresh_overdue_task_notifications();
 */
export async function GET(request: Request) {
  return runOverdueRefresh(request);
}

export async function POST(request: Request) {
  return runOverdueRefresh(request);
}

async function runOverdueRefresh(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET tanımlı değil." },
      { status: 503 }
    );
  }
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Supabase service role yapılandırması eksik." },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (token !== cronSecret) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc("refresh_overdue_task_notifications");
  if (error) {
    const code = String(error.code ?? "");
    const msg = String(error.message ?? "");
    if (code === "42883" || msg.toLowerCase().includes("refresh_overdue_task_notifications")) {
      return NextResponse.json(
        {
          error: "Faz 2 SQL uygulanmamış.",
          hint: "scripts/notifications-assignment-triggers.sql dosyasını Supabase'de çalıştırın.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: msg || "RPC hatası" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    processed: typeof data === "number" ? data : Number(data ?? 0),
  });
}
