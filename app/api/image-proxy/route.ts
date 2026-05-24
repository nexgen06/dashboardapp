import { NextResponse } from "next/server";

/**
 * Görsel proxy — PDF/e-posta üretiminde harici logo'ları base64'e çevirmek için.
 *
 * Akış:
 *  1. İstemci `loadImageDataUri()` fonksiyonu önce doğrudan CORS'lu fetch dener
 *  2. Başarısız olursa bu route'a düşer: `/api/image-proxy?url=https://...`
 *  3. Bu route sunucu tarafında fetch eder (CORS yok) ve `image/*` döner
 *  4. İstemci base64 data-uri'ye çevirir, pdfmake'e gömer
 *
 * Güvenlik:
 *  - SSRF koruması: yalnızca http/https URL'leri ve global IP'ler kabul edilir
 *  - Boyut sınırı: 8 MB (logo için fazlasıyla yeterli)
 *  - MIME doğrulaması: `image/*` content-type zorunlu
 *  - Kimlik doğrulama gerekmez — public logo'lara erişim sağlar
 */

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

// SSRF koruması — özel/lokal IP'lere proxy yapma
function isPrivateOrLocalHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower === "0.0.0.0" || lower === "::1") return true;
  // 10.x, 172.16-31.x, 192.168.x, 127.x, link-local 169.254.x
  if (/^127\./.test(lower)) return true;
  if (/^10\./.test(lower)) return true;
  if (/^192\.168\./.test(lower)) return true;
  if (/^169\.254\./.test(lower)) return true;
  const m = lower.match(/^172\.(\d+)\./);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  // IPv6 localhost / unique-local / link-local
  if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:")) return true;
  return false;
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = (url.searchParams.get("url") ?? "").trim();
  if (!target) {
    return NextResponse.json({ error: "url parametresi zorunlu" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Geçersiz URL" }, { status: 400 });
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return NextResponse.json({ error: "Yalnızca http/https desteklenir" }, { status: 400 });
  }
  if (isPrivateOrLocalHostname(parsed.hostname)) {
    return NextResponse.json({ error: "Özel/lokal IP adreslerine proxy yapılmaz" }, { status: 403 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(parsed.toString(), {
      // Bazı CDN'lar User-Agent talep ediyor
      headers: { "User-Agent": "DashboardApp-ImageProxy/1.0" },
      // 12 saniyelik timeout — logo için bol bol yeterli
      signal: AbortSignal.timeout(12_000),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Kaynak erişilemedi",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Kaynak hata döndürdü: ${upstream.status}` },
      { status: 502 }
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    return NextResponse.json(
      { error: `İçerik resim değil: ${contentType || "tip yok"}` },
      { status: 415 }
    );
  }

  // Boyut kontrolü — Content-Length varsa baştan reddet
  const declaredLength = Number(upstream.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BYTES) {
    return NextResponse.json(
      { error: `Dosya çok büyük (${declaredLength} bayt, maks ${MAX_BYTES})` },
      { status: 413 }
    );
  }

  const arrayBuffer = await upstream.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_BYTES) {
    return NextResponse.json(
      { error: `Dosya çok büyük (${arrayBuffer.byteLength} bayt, maks ${MAX_BYTES})` },
      { status: 413 }
    );
  }

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      // Tarayıcı tarafından okunabilir olması için
      "Access-Control-Allow-Origin": "*",
    },
  });
}
