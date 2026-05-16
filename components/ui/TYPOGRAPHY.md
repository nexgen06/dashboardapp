# Tipografi Konvansiyonu

Bu projede metin boyutları ve hiyerarşisi için anlamsal token'lar kullanılır.
Doğrudan `text-xs`, `text-sm`, `text-base` gibi ham Tailwind sınıflarını kullanmayın;
aşağıdaki token'ları tercih edin.

## Token Tablosu

| Token | Boyut | Kullanım |
|-------|-------|----------|
| `text-ui-caption` | 12 / 16 | Etiket, badge, küçük açıklama, "zorunlu" işareti, breadcrumb |
| `text-ui-body` | **14 / 20** | **Varsayılan body metni.** Form input, paragraf, hücre içeriği |
| `text-ui-body-lg` | 16 / 24 | Vurgulu paragraf, hoş geldin mesajı |
| `text-ui-h3` | 16 / 24, 600 | Kart içi alt başlık (`SectionHeader level="card"`) |
| `text-ui-h2` | 18 / 28, 600 | Bölüm başlığı (`SectionHeader level="section"`) |
| `text-ui-h1` | 24 / 32, 600 | Sayfa başlığı (`SectionHeader level="page"`) |
| `text-ui-display` | 32 / 40, 700 | KPI rakamları, vurgulu büyük sayı |

## Kurallar

1. **Minimum body 14px.** `text-xs` (12px) ve daha küçüğü yalnızca etiket/badge/counter için.
   Paragraf, form, tablo hücresi metinleri `text-ui-body` ya da daha büyük olmalı.
2. **Sayfa başında bir `text-ui-h1`.** Sayfa içinde birden çok H1 olmaz.
3. **Bölüm başlığı için doğrudan `<h2 className="text-ui-h2">` yerine `<SectionHeader />` bileşenini kullan.**
4. **Kontrast:** `text-slate-500 dark:text-slate-400` paterni WCAG AA için yeterli ama yorgun gözleri zorlar.
   Önemli açıklamalarda `dark:text-slate-300` tercih et (SectionHeader subtitle bunu yapar).
5. **Hardcoded piksel değeri (`text-[11px]`, `text-[13px]`) yasak.** Token'lara çek.

## Yaygın Hata → Düzeltme

```diff
- <h2 className="text-base font-semibold text-slate-800">Tüm görevler</h2>
+ <SectionHeader level="section" title="Tüm görevler" />

- <p className="text-xs text-slate-500">Açıklama metni</p>
+ <p className="text-ui-body text-slate-600 dark:text-slate-300">Açıklama metni</p>

- <span className="text-[11px] font-medium uppercase">Kapsam</span>
+ <span className="text-ui-caption font-medium uppercase">Kapsam</span>
```

## Font Ailesi

Geist Sans (`geist/font/sans`) varsayılan font olarak `app/layout.tsx` üzerinden uygulanır.
Tailwind `font-sans` utility'si bu fonta bağlıdır; özel font değişikliği gerekmez.
Monospace gereken yerler için Geist Mono eklenebilir.
