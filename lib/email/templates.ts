/**
 * E-posta HTML şablonları. Inline CSS — çoğu e-posta istemcisi <style> bloklarını
 * sınırlı destekler. Web-uyumlu basit tablolar kullanılır (Outlook için bile).
 */

const BRAND_COLOR = "#2563eb"; // Tailwind blue-600
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://livetable.up.railway.app";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nl2br(s: string): string {
  return s.replace(/\n/g, "<br>");
}

/** Ortak wrapper — header (marka) + content + footer (unsubscribe ipucu) */
function wrap(content: string, headingEmoji: string, heading: string): string {
  return `
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f1f5f9;padding:24px 0;">
  <tr>
    <td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr>
          <td style="background:${BRAND_COLOR};padding:24px;text-align:left;">
            <div style="font-size:14px;color:#dbeafe;margin-bottom:4px;">Dashboard</div>
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">${headingEmoji} ${escapeHtml(heading)}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;font-size:12px;color:#64748b;">
            Bu e-postayı Dashboard üzerinden almak istemiyorsan, uygulamada
            <a href="${APP_URL}/ayarlar" style="color:${BRAND_COLOR};text-decoration:none;">Ayarlar</a>'dan bildirim tercihlerini güncelleyebilirsin.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
  `.trim();
}

/** Duyuru bildirimi e-postası */
export function announcementEmailTemplate(input: {
  title: string;
  body: string;
  authorEmail: string;
}): { subject: string; html: string; text: string } {
  const subject = `📢 Yeni duyuru: ${input.title}`;
  const html = wrap(
    `
    <h2 style="margin:0 0 12px 0;font-size:18px;font-weight:600;color:#0f172a;">${escapeHtml(input.title)}</h2>
    <div style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#334155;white-space:pre-wrap;">${nl2br(escapeHtml(input.body))}</div>
    <div style="margin-top:24px;padding:12px;background:#f8fafc;border-left:3px solid ${BRAND_COLOR};font-size:12px;color:#64748b;">
      Gönderen: ${escapeHtml(input.authorEmail)}
    </div>
    <div style="margin-top:24px;text-align:center;">
      <a href="${APP_URL}/bildirimler"
         style="display:inline-block;padding:10px 20px;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">
        Bildirimler sayfasında aç →
      </a>
    </div>
    `,
    "📢",
    "Yeni Duyuru"
  );
  const text = `Yeni duyuru: ${input.title}\n\n${input.body}\n\nGönderen: ${input.authorEmail}\n\nDetay: ${APP_URL}/bildirimler`;
  return { subject, html, text };
}
