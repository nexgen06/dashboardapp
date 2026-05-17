import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Kullanıcı davet API route (admin-only).
 *
 * Akış:
 *  1. İstek `Authorization: Bearer <access_token>` header'ı ile gelir
 *  2. anon-key client ile token doğrulanır → user.id alınır
 *  3. service-role client ile profiles'tan user.role_id 'admin' mi kontrol edilir
 *  4. Adminse `auth.admin.inviteUserByEmail(email)` çağrılır
 *
 * Service role key SADECE bu server route'unda kullanılır; istemciye sızdırılmaz.
 * `redirectTo` parametresi davetle gelen kullanıcının şifre belirleyeceği sayfa.
 */
export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          "Sunucu yapılandırması eksik. SUPABASE_SERVICE_ROLE_KEY env değişkeni tanımlı olmalı.",
      },
      { status: 500 }
    );
  }

  // 1. Authorization header
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!token) {
    return NextResponse.json({ error: "Yetkilendirme bilgisi eksik." }, { status: 401 });
  }

  // 2. Token'ı doğrula → user
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: "Oturum geçersiz veya süresi dolmuş." }, { status: 401 });
  }
  const callerId = userData.user.id;

  // 3. Admin yetkisi kontrolü (service role ile profiles okur — RLS bypass)
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("role_id")
    .eq("id", callerId)
    .maybeSingle();
  if (profErr) {
    return NextResponse.json({ error: "Profil okunamadı." }, { status: 500 });
  }
  if (!profile || profile.role_id !== "admin") {
    return NextResponse.json({ error: "Bu işlem için admin yetkisi gerekir." }, { status: 403 });
  }

  // 4. Request body'den email
  let body: { email?: unknown; redirectTo?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }
  const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    return NextResponse.json({ error: "Geçerli bir e-posta gerekli." }, { status: 400 });
  }
  const redirectTo =
    typeof body.redirectTo === "string" && body.redirectTo.startsWith("http")
      ? body.redirectTo
      : undefined;

  // 5. Davet et
  const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
    rawEmail,
    redirectTo ? { redirectTo } : undefined
  );
  if (inviteErr) {
    const msg = inviteErr.message ?? "Davet gönderilemedi.";
    // Eğer kullanıcı zaten kayıtlıysa Supabase 422 döner; kullanıcıya net mesaj
    const status =
      /already.*registered|already.*been.*registered|user.*already.*exists/i.test(msg)
        ? 409
        : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  return NextResponse.json({
    ok: true,
    user: inviteData?.user
      ? {
          id: inviteData.user.id,
          email: inviteData.user.email,
        }
      : null,
  });
}
