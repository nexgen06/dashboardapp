import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Avatar yükleme API route — server-side proxy.
 *
 * Akış:
 *  1. İstek `Authorization: Bearer <access_token>` + multipart/form-data ile gelir
 *  2. anon-key client ile token doğrulanır → user.id alınır
 *  3. MIME / boyut doğrulaması
 *  4. service-role client ile dosya `<user_id>/avatar-<ts>.<ext>` yoluna yüklenir
 *  5. Public URL döner; ayrıca profiles.avatar_url güncellenir
 *
 * Storage RLS bu route'un service role kullanması sayesinde bypass edilir.
 * Anon yazma policy'si Storage tablosundan kaldırılabilir — bu route bekçidir.
 */

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

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
    return NextResponse.json(
      { error: "Oturum geçersiz veya süresi dolmuş." },
      { status: 401 }
    );
  }
  const userId = userData.user.id;

  // 3) Form-data oku
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Geçersiz form verisi." }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Dosya alanı bulunamadı." }, { status: 400 });
  }

  // 4) MIME + boyut doğrulaması
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `Geçersiz dosya tipi: ${file.type || "(bilinmiyor)"}. PNG, JPEG, GIF veya WebP olmalı.` },
      { status: 400 }
    );
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: "Dosya boş." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Dosya en fazla ${MAX_BYTES / 1024 / 1024} MB olabilir.` },
      { status: 400 }
    );
  }

  // 5) Service role ile yükle — RLS bypass
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ext = (file.name.split(".").pop() || "png")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8) || "png";
  const path = `${userId}/avatar-${Date.now()}.${ext}`;

  // Eski avatar dosyalarını temizle (kullanıcı klasöründeki diğer avatar-*'ları sil)
  try {
    const { data: existing } = await adminClient.storage.from("avatars").list(userId);
    if (existing && existing.length > 0) {
      const toRemove = existing
        .filter((o) => o.name.startsWith("avatar-"))
        .map((o) => `${userId}/${o.name}`);
      if (toRemove.length > 0) {
        await adminClient.storage.from("avatars").remove(toRemove);
      }
    }
  } catch {
    // Listeleme/silme başarısız olsa bile upload denenmeli
  }

  // Asıl upload
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadErr } = await adminClient.storage
    .from("avatars")
    .upload(path, new Uint8Array(arrayBuffer), {
      contentType: file.type,
      cacheControl: "3600",
      upsert: true,
    });
  if (uploadErr) {
    return NextResponse.json(
      { error: `Yükleme başarısız: ${uploadErr.message}` },
      { status: 500 }
    );
  }

  const { data: urlData } = adminClient.storage.from("avatars").getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  // 6) profiles.avatar_url güncelle (kullanıcının kendi adına — service role bypass)
  const { error: updateErr } = await adminClient
    .from("profiles")
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (updateErr) {
    // Yine de URL'i döndür — kullanıcı kendi de update çağırabilir
    return NextResponse.json(
      { url: publicUrl, warning: `avatar_url profilde güncellenemedi: ${updateErr.message}` },
      { status: 200 }
    );
  }

  return NextResponse.json({ url: publicUrl });
}
