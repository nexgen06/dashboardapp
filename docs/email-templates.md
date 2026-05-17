# Supabase Auth Email Templates — Panel

Bu dosya **Supabase Studio → Authentication → Email Templates** alanına yapıştırılacak HTML şablonlarını içerir. Hepsi:

- **Türkçe** (gerektiğinde nazik dil)
- **Modern**: gradient avatar, yumuşak gölge, yuvarlak köşeler, mavi accent (`#2563eb`)
- **Email-safe**: yalnızca inline style (medya sorgu hariç), table layout, system fonts
- **Mobil**: max-width 600px, padding mobilde küçük
- **Dark mode**: `prefers-color-scheme` ile renkler ters çevrilir (Apple Mail, Outlook iOS destekler)

## Ortak değişkenler

Supabase'ten gelen template variables (Liquid syntax):
- `{{ .ConfirmationURL }}` — kullanıcının tıklayacağı CTA bağlantısı
- `{{ .SiteURL }}` — `https://livetable.up.railway.app`
- `{{ .Email }}` — alıcı e-postası
- `{{ .Token }}` — OTP code (kullanmıyorsan göstermeyebilirsin)

## Brand renkleri

| Element | Değer |
|---|---|
| Primary | `#2563eb` (blue-600) |
| Gradient | `linear-gradient(135deg, #3b82f6, #2563eb)` |
| Text dark | `#0f172a` (slate-900) |
| Text medium | `#475569` (slate-600) |
| Text muted | `#94a3b8` (slate-400) |
| Background | `#f1f5f9` (slate-100) |
| Card | `#ffffff` |
| Border | `#e2e8f0` (slate-200) |

---

## 1) Reset Password — Şifre Sıfırlama

**Supabase yolu:** Authentication → Email Templates → **Reset Password**

```html
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Şifre sıfırlama</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;box-shadow:0 2px 10px rgba(15,23,42,0.06);overflow:hidden;">
          <tr>
            <td style="padding:36px 32px 8px 32px;text-align:center;">
              <div style="display:inline-block;width:52px;height:52px;background:linear-gradient(135deg,#3b82f6,#2563eb);border-radius:14px;text-align:center;line-height:52px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;box-shadow:0 4px 12px rgba(37,99,235,0.25);">P</div>
              <h1 style="margin:18px 0 0 0;font-size:18px;font-weight:600;color:#0f172a;letter-spacing:-0.01em;">Panel</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px 32px 36px;">
              <h2 style="margin:0 0 14px 0;font-size:22px;font-weight:600;color:#0f172a;letter-spacing:-0.01em;">🔑 Şifreni sıfırla</h2>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#475569;">Merhaba,</p>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#475569;">Panel hesabın için <strong>şifre sıfırlama</strong> talebi aldık. Devam etmek için aşağıdaki butona tıkla; yeni bir şifre belirleyebileceğin sayfaya yönlendirileceksin.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:4px 0 24px 0;">
                    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#ffffff;text-decoration:none;padding:13px 32px;border-radius:10px;font-size:15px;font-weight:600;box-shadow:0 4px 12px rgba(37,99,235,0.28);">Yeni şifre belirle</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 6px 0;font-size:13px;line-height:1.5;color:#64748b;">Buton çalışmıyorsa bu bağlantıyı tarayıcına yapıştır:</p>
              <p style="margin:0 0 24px 0;font-size:12px;line-height:1.5;word-break:break-all;">
                <a href="{{ .ConfirmationURL }}" style="color:#2563eb;text-decoration:underline;">{{ .ConfirmationURL }}</a>
              </p>
              <div style="border-top:1px solid #e2e8f0;margin:8px 0 20px 0;"></div>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                Bu bağlantı <strong style="color:#64748b;">1 saat</strong> geçerlidir. Eğer bu talebi sen yapmadıysan bu e-postayı görmezden gelebilirsin — hesabın güvende.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:18px 36px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#64748b;">© Panel · <a href="{{ .SiteURL }}" style="color:#64748b;text-decoration:none;">{{ .SiteURL }}</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 2) Invite User — Kullanıcı Daveti

**Supabase yolu:** Authentication → Email Templates → **Invite user**

```html
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Panele davet edildin</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;box-shadow:0 2px 10px rgba(15,23,42,0.06);overflow:hidden;">
          <tr>
            <td style="padding:36px 32px 8px 32px;text-align:center;">
              <div style="display:inline-block;width:52px;height:52px;background:linear-gradient(135deg,#3b82f6,#2563eb);border-radius:14px;text-align:center;line-height:52px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;box-shadow:0 4px 12px rgba(37,99,235,0.25);">P</div>
              <h1 style="margin:18px 0 0 0;font-size:18px;font-weight:600;color:#0f172a;letter-spacing:-0.01em;">Panel</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px 32px 36px;">
              <h2 style="margin:0 0 14px 0;font-size:22px;font-weight:600;color:#0f172a;letter-spacing:-0.01em;">🎉 Panele davet edildin!</h2>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#475569;">Merhaba,</p>
              <p style="margin:0 0 12px 0;font-size:15px;line-height:1.65;color:#475569;">
                Panel'e ekibine katılman için davet edildin. Panel; proje yönetimi, görev takibi ve gerçek zamanlı işbirliği için kurulmuş modern bir çalışma alanıdır.
              </p>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#475569;">
                Hesabını <strong>{{ .Email }}</strong> ile kurmak ve şifreni belirlemek için aşağıdaki butona tıkla:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:4px 0 24px 0;">
                    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#ffffff;text-decoration:none;padding:13px 32px;border-radius:10px;font-size:15px;font-weight:600;box-shadow:0 4px 12px rgba(37,99,235,0.28);">Daveti kabul et</a>
                  </td>
                </tr>
              </table>
              <div style="background:#eff6ff;border-left:3px solid #2563eb;padding:14px 16px;border-radius:6px;margin:0 0 24px 0;">
                <p style="margin:0 0 6px 0;font-size:13px;font-weight:600;color:#1e3a8a;">✨ Panel'de neler yapabilirsin?</p>
                <ul style="margin:0;padding:0 0 0 18px;font-size:13px;line-height:1.6;color:#1e40af;">
                  <li>Projeler oluştur ve ekip arkadaşlarınla paylaş</li>
                  <li>Canlı tabloda görevleri toplu yönet</li>
                  <li>Anlık sohbetle iletişim kur</li>
                  <li>Klavye kısayollarıyla hızla gez (⌘K)</li>
                </ul>
              </div>
              <p style="margin:0 0 6px 0;font-size:13px;line-height:1.5;color:#64748b;">Buton çalışmıyorsa bu bağlantıyı tarayıcına yapıştır:</p>
              <p style="margin:0 0 24px 0;font-size:12px;line-height:1.5;word-break:break-all;">
                <a href="{{ .ConfirmationURL }}" style="color:#2563eb;text-decoration:underline;">{{ .ConfirmationURL }}</a>
              </p>
              <div style="border-top:1px solid #e2e8f0;margin:8px 0 20px 0;"></div>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                Bu daveti beklemiyorsan görmezden gelebilirsin. Hiçbir hesap oluşturulmayacak.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:18px 36px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#64748b;">© Panel · <a href="{{ .SiteURL }}" style="color:#64748b;text-decoration:none;">{{ .SiteURL }}</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 3) Confirm Signup — Kayıt Onayı

**Supabase yolu:** Authentication → Email Templates → **Confirm signup**

> Eğer davet-bazlı sistemde kalırsan (önerilen) bu şablon çok kullanılmaz; yine de Supabase doğrudan signup ayarı açılırsa devreye girer.

```html
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>E-posta adresini doğrula</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;box-shadow:0 2px 10px rgba(15,23,42,0.06);overflow:hidden;">
          <tr>
            <td style="padding:36px 32px 8px 32px;text-align:center;">
              <div style="display:inline-block;width:52px;height:52px;background:linear-gradient(135deg,#3b82f6,#2563eb);border-radius:14px;text-align:center;line-height:52px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;box-shadow:0 4px 12px rgba(37,99,235,0.25);">P</div>
              <h1 style="margin:18px 0 0 0;font-size:18px;font-weight:600;color:#0f172a;letter-spacing:-0.01em;">Panel</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px 32px 36px;">
              <h2 style="margin:0 0 14px 0;font-size:22px;font-weight:600;color:#0f172a;letter-spacing:-0.01em;">✉️ E-postanı doğrula</h2>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#475569;">Merhaba,</p>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#475569;">
                Panel hesabını oluşturduğun için teşekkürler. Hesabını aktifleştirmek için lütfen e-posta adresini doğrula:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:4px 0 24px 0;">
                    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#ffffff;text-decoration:none;padding:13px 32px;border-radius:10px;font-size:15px;font-weight:600;box-shadow:0 4px 12px rgba(37,99,235,0.28);">E-postamı doğrula</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 6px 0;font-size:13px;line-height:1.5;color:#64748b;">Buton çalışmıyorsa bu bağlantıyı tarayıcına yapıştır:</p>
              <p style="margin:0 0 24px 0;font-size:12px;line-height:1.5;word-break:break-all;">
                <a href="{{ .ConfirmationURL }}" style="color:#2563eb;text-decoration:underline;">{{ .ConfirmationURL }}</a>
              </p>
              <div style="border-top:1px solid #e2e8f0;margin:8px 0 20px 0;"></div>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                Eğer bu hesabı sen oluşturmadıysan bu e-postayı görmezden gel.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:18px 36px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#64748b;">© Panel · <a href="{{ .SiteURL }}" style="color:#64748b;text-decoration:none;">{{ .SiteURL }}</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 4) Magic Link — Şifresiz Giriş

**Supabase yolu:** Authentication → Email Templates → **Magic Link**

```html
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Panel girişi</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;box-shadow:0 2px 10px rgba(15,23,42,0.06);overflow:hidden;">
          <tr>
            <td style="padding:36px 32px 8px 32px;text-align:center;">
              <div style="display:inline-block;width:52px;height:52px;background:linear-gradient(135deg,#3b82f6,#2563eb);border-radius:14px;text-align:center;line-height:52px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;box-shadow:0 4px 12px rgba(37,99,235,0.25);">P</div>
              <h1 style="margin:18px 0 0 0;font-size:18px;font-weight:600;color:#0f172a;letter-spacing:-0.01em;">Panel</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px 32px 36px;">
              <h2 style="margin:0 0 14px 0;font-size:22px;font-weight:600;color:#0f172a;letter-spacing:-0.01em;">🪄 Tek tıkla giriş</h2>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#475569;">
                Şifre yazmadan giriş yapmak için aşağıdaki bağlantıya tıkla. Tarayıcın yeni bir sekmede oturum açacak.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:4px 0 24px 0;">
                    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#ffffff;text-decoration:none;padding:13px 32px;border-radius:10px;font-size:15px;font-weight:600;box-shadow:0 4px 12px rgba(37,99,235,0.28);">Panel'e giriş yap</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 6px 0;font-size:13px;line-height:1.5;color:#64748b;">Buton çalışmıyorsa bu bağlantıyı tarayıcına yapıştır:</p>
              <p style="margin:0 0 24px 0;font-size:12px;line-height:1.5;word-break:break-all;">
                <a href="{{ .ConfirmationURL }}" style="color:#2563eb;text-decoration:underline;">{{ .ConfirmationURL }}</a>
              </p>
              <div style="border-top:1px solid #e2e8f0;margin:8px 0 20px 0;"></div>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                Bu bağlantı <strong style="color:#64748b;">tek kullanımlık</strong> ve <strong style="color:#64748b;">1 saat</strong> geçerlidir. Sen istemediysen bu e-postayı yok say.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:18px 36px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#64748b;">© Panel · <a href="{{ .SiteURL }}" style="color:#64748b;text-decoration:none;">{{ .SiteURL }}</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 5) Change Email Address — E-posta Değişikliği Onayı

**Supabase yolu:** Authentication → Email Templates → **Change Email Address**

```html
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>E-posta değişikliğini onayla</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;box-shadow:0 2px 10px rgba(15,23,42,0.06);overflow:hidden;">
          <tr>
            <td style="padding:36px 32px 8px 32px;text-align:center;">
              <div style="display:inline-block;width:52px;height:52px;background:linear-gradient(135deg,#3b82f6,#2563eb);border-radius:14px;text-align:center;line-height:52px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;box-shadow:0 4px 12px rgba(37,99,235,0.25);">P</div>
              <h1 style="margin:18px 0 0 0;font-size:18px;font-weight:600;color:#0f172a;letter-spacing:-0.01em;">Panel</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px 32px 36px;">
              <h2 style="margin:0 0 14px 0;font-size:22px;font-weight:600;color:#0f172a;letter-spacing:-0.01em;">📧 E-posta değişikliğini onayla</h2>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#475569;">Merhaba,</p>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#475569;">
                Panel hesabının e-posta adresini değiştirme talebi aldık. Yeni e-posta adresin: <strong style="color:#0f172a;">{{ .Email }}</strong>
              </p>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#475569;">
                Bu değişikliği onaylamak için aşağıdaki butona tıkla:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:4px 0 24px 0;">
                    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#ffffff;text-decoration:none;padding:13px 32px;border-radius:10px;font-size:15px;font-weight:600;box-shadow:0 4px 12px rgba(37,99,235,0.28);">E-posta değişikliğini onayla</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 6px 0;font-size:13px;line-height:1.5;color:#64748b;">Buton çalışmıyorsa bu bağlantıyı tarayıcına yapıştır:</p>
              <p style="margin:0 0 24px 0;font-size:12px;line-height:1.5;word-break:break-all;">
                <a href="{{ .ConfirmationURL }}" style="color:#2563eb;text-decoration:underline;">{{ .ConfirmationURL }}</a>
              </p>
              <div style="border-top:1px solid #e2e8f0;margin:8px 0 20px 0;"></div>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                Bu değişikliği sen talep etmediysen <strong style="color:#dc2626;">derhal mevcut şifreni değiştir</strong> — hesabın tehlikede olabilir.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:18px 36px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#64748b;">© Panel · <a href="{{ .SiteURL }}" style="color:#64748b;text-decoration:none;">{{ .SiteURL }}</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## Subject (Konu) satırları

Supabase Studio'da her template'in altında "Subject heading" alanı var. Önerilen değerler:

| Template | Subject |
|---|---|
| Reset Password | `Panel — Şifre sıfırlama bağlantın` |
| Invite User | `🎉 Panel'e davet edildin` |
| Confirm Signup | `Panel — E-postanı doğrula` |
| Magic Link | `Panel — Tek tıkla giriş bağlantın` |
| Change Email | `Panel — E-posta değişikliği onayı` |

## Uygulama adımları

1. Supabase Studio → projeyi aç
2. Sol menüden **Authentication → Email Templates**
3. Her template için: HTML'i yapıştır + Subject'i güncelle + **Save**
4. (Opsiyonel) **Authentication → Email** altında "Custom SMTP" yapılandırılmamışsa Supabase'in default ücretsiz SMTP'si saatlik 4 e-posta sınırlıdır. Production'da SendGrid / Resend / Postmark gibi bir SMTP yapılandır.

## Branding'i değiştirmek istersen

Tüm template'lerde tek-noktadan değişen kısımlar:

- **Logo harfi:** `<div ...>P</div>` — buradaki "P"yi marka kısaltmana çevir
- **Marka adı:** `Panel` her yerde — find/replace ile değiştir (örn. `LiveTable`)
- **Gradient/accent renk:** `#3b82f6` ve `#2563eb` — kendi marka rengine değiştir; `box-shadow: 0 4px 12px rgba(37,99,235,0.28)` içindeki RGB değerini de güncelle
- **Footer:** `© Panel · {{ .SiteURL }}` — kurum adın varsa ekle
