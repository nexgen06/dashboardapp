"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useSettings, ACCENT_COLORS } from "@/contexts/settings-context";
import type { Theme, LiveTableDensity, LiveTableTemplate, AccentColor } from "@/contexts/settings-context";
import { RotateCcw, Upload, X as XIcon } from "lucide-react";
import { SettingRow } from "@/components/settings/SettingRow";
import { matchesSearch } from "@/components/settings/settingsSearch";
import type { SettingsPanelProps } from "@/components/settings/settingsPanelTypes";
import { buildAccentPalette, hexToHsl } from "@/lib/brandColor";

const LOGO_MAX_BYTES = 200 * 1024; // 200KB

export function GorusAyarlarPanel({ searchQuery, resetSection, canResetSettings }: SettingsPanelProps) {
  const { settings, updateSetting } = useSettings();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Picker'ı kullanıcı yazarken her keystroke'ta apply etmek yerine local taslak
  const [brandDraft, setBrandDraft] = useState<string>(settings.brandColor ?? "");

  const themeMatch = matchesSearch(searchQuery, "Tema", "Açık, koyu veya sistem ayarına göre.");
  const accentMatch = matchesSearch(searchQuery, "Vurgu rengi", "Butonların ve seçili öğelerin rengi.");
  const brandMatch = matchesSearch(searchQuery, "Marka rengi", "Kurumsal HEX renginizi tanıtın — tüm vurgular bu renge dönüşür.");
  const logoMatch = matchesSearch(searchQuery, "Kurumsal logo", "Sidebar başlığında Panel yazısı yerine logonuz görünür.");
  const sidebarMatch = matchesSearch(searchQuery, "Sidebar varsayılan", "Sayfa açıldığında sidebar dar mı açık mı olsun.");
  const densityMatch = matchesSearch(
    searchQuery,
    "Canlı Tablo yoğunluğu",
    "Satır aralığı ve yazı boyutu: Yoğun, Normal veya Büyük."
  );
  const templateMatch = matchesSearch(
    searchQuery,
    "Canlı Tablo şablonu",
    "Klasik Excel görünümü veya modern kart dokusu."
  );
  const noneMatch =
    searchQuery.trim() && !themeMatch && !accentMatch && !brandMatch && !logoMatch && !sidebarMatch && !densityMatch && !templateMatch;

  /** HEX'i doğrulayıp setting'e yazar; hatalıysa toast. */
  const applyBrandColor = (hexRaw: string) => {
    const hex = hexRaw.trim();
    if (!hex) {
      updateSetting("brandColor", null);
      return;
    }
    const ok = hexToHsl(hex) && buildAccentPalette(hex);
    if (!ok) {
      toast.error("Geçersiz HEX. Örn: #1d4ed8 veya 1d4ed8");
      return;
    }
    // Normalize: # ile başlasın, lowercase
    const normalized = hex.startsWith("#") ? hex.toLowerCase() : `#${hex.toLowerCase()}`;
    updateSetting("brandColor", normalized);
  };

  /** Dosya → dataURL (max 200KB, sadece image/*) */
  const handleLogoFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Sadece görsel dosyalar (PNG/SVG/JPG) yüklenebilir.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.error(`Logo en fazla ${Math.round(LOGO_MAX_BYTES / 1024)}KB olabilir.`);
      return;
    }
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onerror = () => reject(new Error("Dosya okunamadı"));
        r.onload = () => resolve(String(r.result ?? ""));
        r.readAsDataURL(file);
      });
      if (!dataUrl) {
        toast.error("Dosya okunamadı.");
        return;
      }
      updateSetting("brandLogoDataUrl", dataUrl);
      toast.success("Logo güncellendi.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Logo yüklenemedi";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-2">
      {themeMatch && (
      <SettingRow
        label="Tema"
        description="Açık, koyu veya sistem ayarına göre. Göz yorgunluğunu azaltmak için koyu mod kullanılabilir."
      >
        <select
          value={settings.theme}
          onChange={(e) => updateSetting("theme", e.target.value as Theme)}
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        >
          <option value="light">Açık</option>
          <option value="dark">Koyu</option>
          <option value="system">Sisteme uy</option>
        </select>
      </SettingRow>
      )}
      {accentMatch && (
      <SettingRow
        label="Vurgu rengi"
        description="Butonların, link rengi ve odak halkasının rengi. Diğer renkler etkilenmez."
      >
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Vurgu rengi">
          {ACCENT_COLORS.map((c) => {
            const selected = settings.accentColor === c.value;
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={c.label}
                title={c.label}
                onClick={() => updateSetting("accentColor", c.value as AccentColor)}
                className={
                  selected
                    ? "relative h-8 w-8 rounded-full ring-2 ring-offset-2 ring-slate-900 dark:ring-slate-100 dark:ring-offset-slate-800 transition-transform"
                    : "relative h-8 w-8 rounded-full transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800"
                }
                style={{ backgroundColor: c.preview }}
              >
                {selected && (
                  <span
                    className="absolute inset-0 flex items-center justify-center text-white"
                    aria-hidden
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </SettingRow>
      )}
      {brandMatch && (
      <SettingRow
        label="Marka rengi"
        description="Kurumsal HEX renginizi girin (örn. #1d4ed8). Tüm vurgular ve butonlar bu renge dönüşür; girilmezse yukarıdaki ön ayar kullanılır."
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* Native color picker — anlık preview için onChange'de apply */}
          <input
            type="color"
            value={(settings.brandColor ?? brandDraft) || "#1d4ed8"}
            onChange={(e) => {
              setBrandDraft(e.target.value);
              applyBrandColor(e.target.value);
            }}
            aria-label="Marka rengi seçici"
            className="h-9 w-12 cursor-pointer rounded-md border border-slate-200 bg-white p-0.5 dark:border-slate-600 dark:bg-slate-700"
          />
          {/* HEX text input — manuel giriş */}
          <input
            type="text"
            inputMode="text"
            placeholder="#1d4ed8"
            value={brandDraft}
            onChange={(e) => setBrandDraft(e.target.value)}
            onBlur={() => applyBrandColor(brandDraft)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyBrandColor(brandDraft);
              }
            }}
            className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            aria-label="HEX renk kodu"
          />
          {settings.brandColor && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setBrandDraft("");
                updateSetting("brandColor", null);
              }}
              className="text-slate-600 dark:text-slate-400"
            >
              <XIcon className="mr-1.5 h-3.5 w-3.5" />
              Marka rengini kaldır
            </Button>
          )}
          {settings.brandColor && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Aktif: <span className="font-mono">{settings.brandColor}</span>
            </span>
          )}
        </div>
      </SettingRow>
      )}
      {logoMatch && (
      <SettingRow
        label="Kurumsal logo"
        description="Sidebar başlığında 'Panel' yazısı yerine logonuz görünür. PNG/SVG/JPG, max 200KB. Yatay oranlı küçük logo en iyi sonucu verir."
      >
        <div className="flex flex-wrap items-center gap-3">
          {settings.brandLogoDataUrl ? (
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-600 dark:bg-slate-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={settings.brandLogoDataUrl}
                alt="Logo önizleme"
                className="h-9 max-w-[160px] object-contain"
              />
            </div>
          ) : (
            <span className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
              Logo yüklenmemiş
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/svg+xml,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleLogoFile(f);
              // input'u sıfırla — aynı dosya tekrar seçilebilsin
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {settings.brandLogoDataUrl ? "Değiştir" : "Yükle"}
          </Button>
          {settings.brandLogoDataUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => updateSetting("brandLogoDataUrl", null)}
              className="text-slate-600 dark:text-slate-400"
            >
              <XIcon className="mr-1.5 h-3.5 w-3.5" />
              Kaldır
            </Button>
          )}
        </div>
      </SettingRow>
      )}
      {sidebarMatch && (
      <SettingRow
        label="Sidebar varsayılan"
        description="Sayfa açıldığında sidebar dar mı açık mı olsun."
      >
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.sidebarCollapsedByDefault}
            onChange={(e) => updateSetting("sidebarCollapsedByDefault", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">Varsayılan olarak daraltılmış</span>
        </label>
      </SettingRow>
      )}
      {densityMatch && (
      <SettingRow
        label="Canlı Tablo yoğunluğu"
        description="Canlı Tablo sayfasındaki satır aralığı ve yazı boyutu. Aynı seçenek tablo araç çubuğundan da değiştirilebilir."
      >
        <select
          value={settings.liveTableDensity}
          onChange={(e) => updateSetting("liveTableDensity", e.target.value as LiveTableDensity)}
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        >
          <option value="compact">Yoğun</option>
          <option value="normal">Normal</option>
          <option value="comfortable">Büyük</option>
        </select>
      </SettingRow>
      )}
      {templateMatch && (
      <SettingRow
        label="Canlı Tablo şablonu"
        description="Hücre düzeni değişmeden görünüm seçin: Klasik (Excel benzeri) veya Modern (Untitled-UI tarzı)."
      >
        <select
          value={settings.liveTableTemplate}
          onChange={(e) => updateSetting("liveTableTemplate", e.target.value as LiveTableTemplate)}
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        >
          <option value="classic">Klasik</option>
          <option value="modern">Modern</option>
        </select>
      </SettingRow>
      )}
      <SettingRow
        label="Toolbar arayüz tarzı"
        description="Canlı Tablo üst toolbar görünümü. Klasik: çoklu bar (mevcut, tüm seçenekler görünür). Modern: Linear/Notion-style tek-satır primary bar (sade, dropdown drill). Her iki tasarım arasında anlık geçiş yapabilirsiniz."
      >
        <select
          value={settings.toolbarStyle}
          onChange={(e) => updateSetting("toolbarStyle", e.target.value as "classic" | "modern")}
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        >
          <option value="classic">Klasik (çoklu bar)</option>
          <option value="modern">Modern (tek satır)</option>
        </select>
      </SettingRow>
      {noneMatch && <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Arama kriterine uyan ayar yok.</p>}
      {canResetSettings && (
      <div className="pt-4">
        <Button type="button" variant="outline" size="sm" onClick={() => resetSection("gorunum")} className="text-slate-600 dark:text-slate-400">
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
          Bu bölümü varsayılana sıfırla
        </Button>
      </div>
      )}
    </div>
  );
}
