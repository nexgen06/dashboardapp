/**
 * Brand color → accent palette üretici.
 *
 * Müşterinin tek bir kurumsal HEX rengini alıp Tailwind-style 50..950
 * tonlu paleti üretir. Sonuç --accent-* CSS değişkenleri olarak root'a
 * yazılır (ApplySettings).
 *
 * Yaklaşım:
 *   - HEX → HSL'e dönüştür
 *   - Hue korunur; saturation hafifçe ayarlanır; lightness her ton için sabit eğri
 *   - Tailwind blue paletinin lightness eğrisi referans alındı:
 *       50:96, 100:93, 200:87, 300:78, 400:68, 500:60, 600:53,
 *       700:48, 800:40, 900:33, 950:21
 *   - 500 tonu için saturation kullanıcının verdiği rengin saturation'ı; diğer tonlar tempo
 *     hafifçe düşürülmüş bir saturation ile (renksiz görünmesin diye)
 */

export type Hsl = { h: number; s: number; l: number };

const TONE_LIGHTNESS: Record<string, number> = {
  "50": 96,
  "100": 93,
  "200": 87,
  "300": 78,
  "400": 68,
  "500": 60,
  "600": 53,
  "700": 48,
  "800": 40,
  "900": 33,
  "950": 21,
};

export const ACCENT_TONE_KEYS = Object.keys(TONE_LIGHTNESS) as Array<keyof typeof TONE_LIGHTNESS>;

/** "#1d4ed8" / "1d4ed8" / "#1d4" → {h,s,l}. Geçersizse null. */
export function hexToHsl(hex: string): Hsl | null {
  if (!hex) return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let hue = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        hue = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        hue = (b - r) / d + 2;
        break;
      case b:
        hue = (r - g) / d + 4;
        break;
    }
    hue *= 60;
  }
  return {
    h: Math.round(hue),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/** Verilen kurumsal HEX'ten 11 tonluk accent paleti üretir. */
export function buildAccentPalette(hex: string): Record<string, string> | null {
  const base = hexToHsl(hex);
  if (!base) return null;
  // 500 tonunda kullanıcının saturation'ı kullanılır; uç tonlar biraz desaturate edilir
  // ki çok parlak / zehir yeşil görünmesin.
  const baseSat = Math.max(35, Math.min(95, base.s));
  const result: Record<string, string> = {};
  for (const tone of ACCENT_TONE_KEYS) {
    const targetL = TONE_LIGHTNESS[tone];
    // Saturation eğrisi: 500 = baseSat, uç tonlar -8..-15 puan azaltılmış
    // (50/950 çok soluk veya çok koyuda renkli kalmasın diye)
    const toneNum = Number(tone);
    let satDelta = 0;
    if (toneNum <= 100) satDelta = -10;
    else if (toneNum <= 200) satDelta = -6;
    else if (toneNum <= 400) satDelta = -3;
    else if (toneNum >= 900) satDelta = -8;
    else if (toneNum >= 800) satDelta = -4;
    const s = Math.max(10, Math.min(100, baseSat + satDelta));
    result[tone] = `${base.h} ${s}% ${targetL}%`;
  }
  return result;
}

/** HSL string ("221 83% 53%") → readable hex for previews. */
export function hslStringToHex(hsl: string): string | null {
  const m = hsl.match(/^(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!m) return null;
  const h = Number(m[1]);
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const mLight = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const to255 = (v: number) => Math.round((v + mLight) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${to255(r)}${to255(g)}${to255(b)}`;
}
