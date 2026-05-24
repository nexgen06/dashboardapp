import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Mention bildirimi gönderme API route'u — yorum yazılırken `@user` edilen
 * kullanıcılara `task_assigned` benzeri bildirim push'lar.
 *
 * Akış:
 *  1. `Authorization: Bearer <token>` ile çağrı doğrulanır
 *  2. Body: { taskId, taskContent, projectId, mentionedEmails }
 *  3. Service role ile profiles.user_id resolve edilir (RLS bypass)
 *  4. Service role ile notifications tablosuna her recipient için insert
 *  5. Kendi kendine mention atlanır (caller mentioned dahil değil)
 *
 * Güvenlik: RLS notifications için `recipient_id = auth.uid()` zorunlu;
 * service-role bunu bypass eder. Kötüye kullanım sınırı için max 20 mention/istek.
 */

const MAX_MENTIONS_PER_REQUEST = 20;

type Body = {
  taskId?: string;
  taskContent?: string;
  projectId?: string | null;
  mentionedEmails?: string[];
};

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ error: "Sunucu yapılandırması eksik." }, { status: 500 });
  }

  // 1) Token doğrula
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!token) {
    return NextResponse.json({ error: "Yetkilendirme eksik." }, { status: 401 });
  }

  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: "Oturum geçersiz." }, { status: 401 });
  }
  const callerId = userData.user.id;
  const callerEmail = (userData.user.email ?? "").trim().toLowerCase();

  // 2) Body parse
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }
  const taskId = (body.taskId ?? "").trim();
  const taskContent = (body.taskContent ?? "").trim().slice(0, 200) || "(içeriksiz görev)";
  const projectId = body.projectId ? String(body.projectId).trim() : null;
  const mentionedEmailsRaw = Array.isArray(body.mentionedEmails) ? body.mentionedEmails : [];

  if (!taskId) {
    return NextResponse.json({ error: "taskId zorunlu." }, { status: 400 });
  }

  // 3) Mention listesini normalize et: lowercase, unique, kendini hariç tut, max sınır
  const normalized = Array.from(
    new Set(
      mentionedEmailsRaw
        .map((e) => String(e ?? "").trim().toLowerCase())
        .filter((e) => e && e !== callerEmail)
    )
  ).slice(0, MAX_MENTIONS_PER_REQUEST);

  if (normalized.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: "self-or-empty" });
  }

  // 4) Service role client — RLS bypass
  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 5) Email → user_id eşle (profiles tablosu)
  const { data: profiles, error: profErr } = await service
    .from("profiles")
    .select("id, email")
    .in("email", normalized);
  if (profErr) {
    console.warn("[notify/mention] profiles lookup:", profErr.message);
    return NextResponse.json({ error: "Kullanıcılar yüklenemedi." }, { status: 500 });
  }
  const recipients = (profiles ?? [])
    .map((p: { id: string; email: string | null }) => ({ id: String(p.id), email: (p.email ?? "").trim().toLowerCase() }))
    .filter((p) => p.id !== callerId); // ekstra güvenlik — caller'ın kendi profili de gelebilir

  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: "no-resolved-recipients" });
  }

  // 6) Notifications insert — recipient başına bir row
  const href = projectId ? `/projeler/${projectId}?openTask=${taskId}` : `/canli-tablo?openTask=${taskId}`;
  const now = new Date().toISOString();
  const rows = recipients.map((r) => ({
    recipient_id: r.id,
    type: "task_assigned" as const, // mevcut tip — UI'da ListTodo ikonu ile gösterilir
    title: "Bir yorumda etiketlendiniz",
    body: taskContent.length > 120 ? `${taskContent.slice(0, 117)}…` : taskContent,
    href,
    count: 1,
    source_table: "task_comments",
    source_id: taskId,
    source_key: `mention:${taskId}:${r.id}:${now}`,
    payload: { kind: "mention", taskId, projectId, by: callerEmail },
    created_at: now,
    updated_at: now,
  }));

  const { error: insertErr } = await service.from("notifications").insert(rows);
  if (insertErr) {
    console.warn("[notify/mention] insert:", insertErr.message);
    return NextResponse.json({ error: "Bildirim oluşturulamadı." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sent: recipients.length });
}
