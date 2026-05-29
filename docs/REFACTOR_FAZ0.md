# Refactor Faz 0 — Güvenlik ağı

Bu doküman, kademeli mimari refactor öncesinde regresyonu erken yakalamak için hazırlanmıştır.  
Her sonraki faz PR'ından önce **Smoke test** ve `npm test` + `npm run build` koşulmalıdır.

---

## 1. Hook envanteri

### `useProjects()` — 22 dosya (Faz 2: `ProjectsProvider`)

| Öncelik | Dosya | Not |
|---------|-------|-----|
| **Global shell** | `hooks/useNotificationSummary.ts` | Her oturumlu sayfada çalışır |
| **Global shell** | `contexts/project-chat-unread-context.tsx` | Duplicate fetch riski |
| Sayfa | `app/mesajlar/page.tsx` | |
| Sayfa | `app/gorevlerim/page.tsx` | |
| Sayfa | `app/raporlar/page.tsx` | |
| Sayfa | `app/yonetim/cip-kutuphanesi/page.tsx` | |
| Sayfa | `app/yonetim/gorev-istatistikleri/page.tsx` | |
| Sayfa | `app/yonetim/otomasyon-merkezi/page.tsx` | |
| Sayfa | `app/yonetim/kurumsal-admin/page.tsx` | |
| Sayfa | `app/yonetim/rapor-sablonlari/page.tsx` | |
| Sayfa | `app/projeler/[id]/page.tsx` | |
| Bileşen | `components/ProjectsSection.tsx` | Monolit (Faz 6) |
| Bileşen | `components/TasksTable.tsx` | Monolit (Faz 7) |
| Bileşen | `components/DashboardSection.tsx` | |
| Bileşen | `components/GorevOzeti.tsx` | |
| Bileşen | `components/TasksKanban.tsx` | |
| Bileşen | `components/TasksCalendar.tsx` | |
| Bileşen | `components/TasksGantt.tsx` | |
| Bileşen | `components/TasksRiskView.tsx` | |
| Bileşen | `components/CommandPalette.tsx` | Yaprak — Faz 2 ilk aday |
| Bileşen | `components/ProjectColumnManager.tsx` | Yaprak — Faz 2 ilk aday |
| Bileşen | `components/layout/MobileFAB.tsx` | |

**Faz 2 geçiş sırası (önerilen):** `CommandPalette` → `ProjectColumnManager` → `cip-kutuphanesi` → `DashboardSection` → … → `NotificationProvider` (son).

### `useTasksWithRealtime()` — 17 dosya (Faz 3: `TasksProvider`)

| Öncelik | Dosya | Not |
|---------|-------|-----|
| **Global shell** | `hooks/useNotificationSummary.ts` | Faz 4'te kaldırılacak |
| Sayfa | `app/gorevlerim/page.tsx` | |
| Sayfa | `app/raporlar/page.tsx` | |
| Sayfa | `app/yonetim/gorev-istatistikleri/page.tsx` | |
| Sayfa | `app/yonetim/otomasyon-merkezi/page.tsx` | |
| Sayfa | `app/yonetim/kurumsal-admin/page.tsx` | |
| Sayfa | `app/projeler/[id]/page.tsx` | |
| Bileşen | `components/ProjectsSection.tsx` | |
| Bileşen | `components/TasksTable.tsx` | Tek rota: `/canli-tablo` |
| Bileşen | `components/DashboardSection.tsx` | |
| Bileşen | `components/GorevOzeti.tsx` | |
| Bileşen | `components/TasksKanban.tsx` | |
| Bileşen | `components/TasksCalendar.tsx` | |
| Bileşen | `components/TasksGantt.tsx` | |
| Bileşen | `components/TasksRiskView.tsx` | |
| Bileşen | `components/layout/MobileFAB.tsx` | |

**Kaynak dosyalar:** `hooks/useProjects.ts`, `hooks/useTasksWithRealtime.ts`

---

## 2. Monolit envanteri (referans)

| Dosya | Satır (yaklaşık) | Hedef faz |
|-------|------------------|-----------|
| `components/TasksTable.tsx` | ~8.100 | Faz 7 |
| `components/ProjectsSection.tsx` | ~3.600 | Faz 6 |
| `app/ayarlar/page.tsx` | ~1.400 | Faz 5 |
| `app/yonetim/otomasyon-merkezi/page.tsx` | ~1.400 | Faz 5 |
| `hooks/useNotificationSummary.ts` | ~820 | Faz 4 |

---

## 3. Smoke test listesi (manuel)

Her refactor PR'ından sonra işaretle.

### Kimlik ve navigasyon
- [ ] **S1** — `/giris` ile giriş; Dashboard'a yönlendirme
- [ ] **S2** — Çıkış; korumalı sayfada `/giris`'e düşme
- [ ] **S3** — Sidebar: Projeler, Canlı Tablo, Ayarlar rotaları açılır

### Canlı Tablo (`/canli-tablo`)
- [ ] **S4** — Görev listesi yüklenir; Realtime bağlantı göstergesi (varsa)
- [ ] **S5** — Global arama + durum filtresi sonuçları daraltır
- [ ] **S6** — Satır düzenle (durum/atanan); kayıt kalıcı
- [ ] **S7** — Export (CSV veya Excel) indirilebilir dosya üretir
- [ ] **S8** — Klavye: `F` filtre, `J`/`K` satır gezinme (opsiyonel)

### Projeler
- [ ] **S9** — Proje listesi; yeni proje oluştur
- [ ] **S10** — Proje detay `/projeler/[id]`; görev listesi ve ekleme

### Bildirimler
- [ ] **S11** — Header zil rozeti; dropdown liste
- [ ] **S12** — Atama bildirimi toast (Faz 2 aktif ortamda)

### Dashboard ve diğer
- [ ] **S13** — `/` KPI kartları ve son projeler
- [ ] **S14** — `/gorevlerim` bana atanan görevler

### Otomasyon (CI)
- [ ] **S15** — `npm test` tüm testler geçer
- [ ] **S16** — `npm run build` hatasız tamamlanır

---

## 4. Unit test kapsamı (Faz 0)

Refactor öncesi kritik `lib/` modülleri:

| Modül | Test dosyası | Durum |
|-------|--------------|-------|
| `liveTableFilters.ts` | `liveTableFilters.test.ts` | Faz 0 |
| `liveTableAdvancedFilters.ts` | `liveTableAdvancedFilters.test.ts` | Faz 0 |
| `projectDetailPageHelpers.ts` | `projectDetailPageHelpers.test.ts` + `projectDetailSprint1.test.ts` | Faz 0 |
| `filterProjectTasks` | `projectDetailSprint1.test.ts` | Mevcut |

---

## 5. Repoda tutulmayacaklar

- `backups/` — `.gitignore`'da; refactor sırasında karışıklık yaratmaması için commit edilmez
- `.env.local` — gizli anahtarlar

---

## 6. Sonraki faz

**Faz 1 (devam):** `ProjectFormModal` → `components/projects/ProjectFormModal.tsx` ✅  
**Sırada:** `ReferenceSelectCell`, `SubtitleColumnsPicker` ayrı dosyalar; ardından Faz 2 `ProjectsProvider`
