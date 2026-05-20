import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/resend";
import { announcementEmailTemplate } from "@/lib/email/templates";

/**
 * Yeni duyuru e-postası gönderir.
 *
 * Akış:
 *  1. Authorization: Bearer JWT
 *  2. JWT'yi anon-key client ile doğrula → kullanıcı admin mi?
 *  3. email_notification_settings → announcement_new enabled mı?
 *  4. announcementId ile duyuruyu çek (service-role)
 *  5. Tüm aktif kullanıcıların email'lerini çek (profiles)
 *  6. HTML şablon → Resend → BCC ile toplu gönderim
 *
 * Body: { announcementId: string }
 *
 * Phase 1 toggle KAPALI iken: 200 OK + "skipped: feature disabled" döner,
 *   admin uygulamayı normal kullanmaya devam eder, mail gitmez.
 */
export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Sunucu yapılandırması eksik." },
      { status: 500 }
    );
  }

  // 1) Authorization
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!token) {
    return NextResponse.json({ error: "Yetkilendirme eksik." }, { status: 401 });
  }

  // 2) Token doğrula
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: "Oturum geçersiz." }, { status: 401 });
  }
  const callerId = userData.user.id;

  // Body parse
  let body: { announcementId?: string };
  try {
    body = (await request.json()) as { announcementId?: string };
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövde." }, { status: 400 });
  }
  const announcementId = body.announcementId?.trim();
  if (!announcementId) {
    return NextResponse.json({ error: "announcementId zorunlu." }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 3) Caller admin mi?
  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("role_id")
    .eq("id", callerId)
    .maybeSingle();
  if (profErr || profile?.role_id !== "admin") {
    return NextResponse.json({ error: "Sadece admin." }, { status: 403 });
  }

  // 4) email_notification_settings → enabled mı?
  const { data: setting, error: setErr } = await admin
    .from("email_notification_settings")
    .select("enabled")
    .eq("event_key", "announcement_new")
    .maybeSingle();
  if (setErr) {
    return NextResponse.json(
      { error: `Ayar okunamadı: ${setErr.message}` },
      { status: 500 }
    );
  }
  if (!setting?.enabled) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "announcement_new e-posta ayarı KAPALI.",
    });
  }

  // 5) Duyuruyu çek
  const { data: announcement, error: annErr } = await admin
    .from("announcements")
    .select("title, body, author_email")
    .eq("id", announcementId)
    .maybeSingle();
  if (annErr || !announcement) {
    return NextResponse.json(
      { error: annErr?.message ?? "Duyuru bulunamadı." },
      { status: 404 }
    );
  }

  // 6) Alıcı listesi: profiles'taki tüm email'ler (kendisi hariç değil — author
  // da almak isteyebilir; istersen `.neq('email', author_email)` ile filtrele)
  const { data: profiles, error: pErr } = await admin
    .from("profiles")
    .select("email")
    .not("email", "is", null);
  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }
  let recipients = (profiles ?? [])
    .map((p) => String((p as Record<string, unknown>).email ?? "").trim())
    .filter((e) => e && e.includes("@"));

  // Resend sandbox: RESEND_TEST_RECIPIENT tanımlıysa, sadece o adrese gönder
  // (domain doğrulanmadan önce test için). Production'da bu env'i kaldır.
  const testRecipient = process.env.RESEND_TEST_RECIPIENT?.trim();
  if (testRecipient && testRecipient.includes("@")) {
    recipients = recipients.includes(testRecipient) ? [testRecipient] : [testRecipient];
  }

  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Alıcı yok." });
  }

  // 7) Şablon + gönderim
  const tpl = announcementEmailTemplate({
    title: announcement.title as string,
    body: announcement.body as string,
    authorEmail: announcement.author_email as string,
  });

  const result = await sendEmail({
    to: recipients,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    replyTo: announcement.author_email as string,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, recipientCount: recipients.length },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    sent: true,
    messageId: result.id,
    recipientCount: recipients.length,
  });
}
