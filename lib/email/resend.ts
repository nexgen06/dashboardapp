/**
 * Resend API client — SERVER-ONLY.
 * Hiçbir client component'tan import edilmemeli; RESEND_API_KEY gizli kalır.
 *
 * Resend docs: https://resend.com/docs/api-reference/emails/send-email
 */

const RESEND_API_URL = "https://api.resend.com/emails";

export type SendEmailInput = {
  /** Tek alıcı veya birden fazla (BCC ile gönderilir; alıcılar birbirini görmez) */
  to: string | string[];
  subject: string;
  html: string;
  /** Düz metin alternatif (spam puanını düşürür) */
  text?: string;
  /** Reply-to header (kullanıcı cevap yazarsa nereye gitsin) */
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Tek bir e-posta gönderir. Çoklu alıcı için array geçilir; Resend BCC kullanır
 * (her alıcı sadece kendi e-postasını görür).
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY env değişkeni tanımlı değil." };
  }

  // FROM adresi — Resend onboard@resend.dev test için kullanılabilir; production'da
  // domain doğrulanmış olmalı (örn. noreply@yourdomain.com).
  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  if (recipients.length === 0) {
    return { ok: false, error: "Alıcı listesi boş." };
  }

  // Çoklu alıcıda BCC pattern (gizlilik için). Resend'in `bcc` field'ı destekler.
  const body =
    recipients.length === 1
      ? {
          from,
          to: recipients,
          subject: input.subject,
          html: input.html,
          ...(input.text ? { text: input.text } : {}),
          ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        }
      : {
          from,
          to: [from], // BCC ile gönderim — alıcılar birbirini görmez
          bcc: recipients,
          subject: input.subject,
          html: input.html,
          ...(input.text ? { text: input.text } : {}),
          ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        };

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Resend ${res.status}: ${errBody || res.statusText}`,
      };
    }

    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id ?? "" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Resend isteği başarısız.",
    };
  }
}
