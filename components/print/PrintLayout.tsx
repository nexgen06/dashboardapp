"use client";

import { useSettings } from "@/contexts/settings-context";

/**
 * Print-only header — kurumsal logo + rapor başlığı + tarih.
 *
 * Yalnızca `@media print` aktifken görünür (`.print-only` class).
 * Yazdırılacak sayfanın en üstüne yerleştirilir. CSS @page bottom-center
 * sayfa numarasını yazar (tarayıcı destekliyorsa).
 *
 * Kullanım:
 *   <PrintHeader title="Görev Raporu" subtitle="Son 30 gün" />
 */
export function PrintHeader({
  title,
  subtitle,
  brandName = "Panel",
}: {
  title: string;
  subtitle?: string;
  brandName?: string;
}) {
  const { settings } = useSettings();
  const today = new Date().toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="print-only print-header" aria-hidden>
      <div style={{ display: "flex", alignItems: "center", gap: "12pt" }}>
        {settings.brandLogoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.brandLogoDataUrl} alt={brandName} className="print-logo" />
        ) : (
          <div
            style={{
              width: "32pt",
              height: "32pt",
              borderRadius: "6pt",
              background: "linear-gradient(135deg, #6366f1, #a855f7, #d946ef)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "14pt",
            }}
          >
            {brandName.charAt(0).toLocaleUpperCase("tr")}
          </div>
        )}
        <div>
          <div className="print-title">{title}</div>
          {subtitle && (
            <div style={{ fontSize: "10pt", color: "#475569", marginTop: "2pt" }}>{subtitle}</div>
          )}
        </div>
      </div>
      <div className="print-meta">
        <div>{brandName}</div>
        <div>{today}</div>
      </div>
    </header>
  );
}

/**
 * Print-only footer — kurumsal not + tarih damgası.
 * Sayfa numarası CSS @page bottom-center'da render edilir; ekstra footer
 * marka damgası için.
 */
export function PrintFooter({ brandName = "Panel" }: { brandName?: string }) {
  return (
    <footer className="print-only print-footer" aria-hidden>
      © {new Date().getFullYear()} {brandName} — Bu rapor uygulama tarafından otomatik oluşturulmuştur.
    </footer>
  );
}
