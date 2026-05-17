# Renk Sistemi

Bu projedeki renk kullanımı **semantic** (anlamsal) bir sistemdir; renkler
bilinçli olarak belirli kavramlara bağlanmıştır. Yeni bir renk eklemeden önce
mevcut paletten uygun olanı seçin.

## Anlamsal Renkler (CRUD + Geri Bildirim)

| Token | Tailwind | Anlam | Örnek Kullanım |
|-------|----------|-------|----------------|
| **success** | `emerald-*` | Tamamlandı, başarılı, olumlu sonuç | Toast success, "Tamamlandı" durum badge'i, KPI completion%, copy "kopyalandı" |
| **warning** | `amber-*` | Dikkat, devam ediyor, ara durum | "Devam ediyor" badge, mutation pending, generic warning |
| **urgent** | `orange-*` | Bugün son tarihli, acil ama hatalı değil | GorevOzeti "today" görev kartı (warning'ten bir tık üst) |
| **danger** | `red-*` | Gecikmiş, hata, silme | Toast error, "Gecikmiş" badge, silme onayı, RLS hatası |
| **primary** | `blue-*` | Birincil aksiyon, link, marka rengi | Yeni proje butonu, navigation, focus ring, gerçek-zamanlı status |

## Filtre Chip Renkleri (Bilinçli Çeşitlilik)

Canlı Tablo'da farklı filtre türleri görsel olarak ayırt edilsin diye her
filtre tipi kendi rengini taşır. Bu **kasıtlı bir çeşitlilik**, semantic değil:

| Filtre | Renk |
|--------|------|
| Arama (search) | `violet` |
| Durum (status) | `amber` |
| Atanan (assignee) | `emerald` |
| Proje | `sky` |
| Tarih | `indigo` |
| Sütun (column) | `cyan` |
| Gelişmiş (advanced) | `blue` |

## Yardımcı Renkler

| Token | Tailwind | Kullanım |
|-------|----------|----------|
| **neutral** | `slate-*` | Border, body, secondary text, devre dışı state |
| **presence** | `violet-*` | Realtime "başkası düzenliyor" işareti |
| **muted** | `slate-50` / `slate-800` | Subtle background |

## Avatar Renkleri (Çeşitlilik İçin)

`components/ui/avatar-stack.tsx` 8 farklı ton kullanır:
`blue / emerald / amber / violet / rose / cyan / indigo / fuchsia`

E-postanın hash'inden deterministik olarak seçilir. Kullanıcıları görsel
olarak ayırt etmeye yarar; semantic anlam taşımaz.

## Kurallar

1. **Yeni renk EKLEME** — önce mevcut paletten uygun olanı dene.
   Gerçekten yoksa bu dosyayı güncelle.
2. **Toast kullan** — başarı/hata mesajları için bg-color kart yapmak
   yerine `toast.success()` / `toast.error()` kullan.
3. **Aksiyon butonları primary** — yeşil "kaydet" butonu yapma; mavi
   `bg-blue-600` standart.
4. **Status badge'leri için** `lib/statusKind.ts` helper'ı kullan;
   getStatusKind() sonucunu emerald/amber/slate gruplarına eşleyebilirsin.

## Yasak Eşler

- ❌ `green-*` → kullanma, **emerald** kullan
- ❌ `yellow-*` → kullanma, **amber** veya **orange** kullan
- ❌ Aynı ekranda 5+ farklı semantic renk — görsel kakofoni; reduce et

## Koyu Mod

Tüm renkler `dark:` varyantıyla beraber tanımlanmalı.
Yardımcı paternler:
- `bg-emerald-50` → `dark:bg-emerald-900/30`
- `text-emerald-700` → `dark:text-emerald-300`
- `border-emerald-200` → `dark:border-emerald-700`

Lightness farkı genelde 600 birimdir (50 ↔ 900, 200 ↔ 700, 700 ↔ 300).
