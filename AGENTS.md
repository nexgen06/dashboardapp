# AGENTS.md — Code Agent Çalışma Standardı

> Bu dosya **tüm kod ajanları** (Claude Code, Cursor, Copilot, Windsurf, Devin, vb.) için **standart işleyişi** belirler. Hangi ajanı kullanırsan kullan, **aynı dizine, aynı süreçle deploy edebilmelisin**.
>
> **CI hata mailinden kurtulmanın yolu**: Aşağıdaki "Push öncesi kontrol listesi"ni uygula.

---

## 🚀 Hızlı Başlangıç (yeni ajan / yeni klon)

```bash
# 1. Repo klonla
git clone https://github.com/nexgen06/dashboardapp.git
cd dashboardapp

# 2. Bağımlılıkları yükle (Node 20.x gereklidir, .nvmrc varsa onu kullan)
npm ci

# 3. Git hook'larını aktive et — push öncesi doğrulama (TEK SEFERLİK)
bash scripts/install-git-hooks.sh

# 4. Dev sunucu
npm run dev   # → http://localhost:3000
```

---

## 📜 Standart NPM Komutları

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Dev sunucusu (hot reload) |
| `npm run typecheck` | `tsc --noEmit` — TypeScript hatası kontrol |
| `npm run lint` | `next lint` — ESLint (warning'ler bilgi, error'lar fail) |
| `npm test` | `vitest run` — birim testler |
| `npm run build` | `next build` — production build |
| `npm run verify` | **typecheck + lint + test + build** (CI'nın yaptığının aynısı) |
| `npm run verify:fast` | typecheck + lint (hızlı, build dahil değil) |

---

## ✅ Push Öncesi Zorunlu Kontrol Listesi

**Hiçbir ajan CI'da hata almasın diye:**

```bash
# Tek komut — CI'nın eşdeğeri
npm run verify
```

Bu yeşil ise → CI de yeşil olacak.

**Pre-push git hook** otomatik çalışır (`bash scripts/install-git-hooks.sh` çalıştırdıysan). Acil durumda atla:

```bash
git push --no-verify   # SADECE acil durumda
```

---

## 🔧 Sık Karşılaşılan CI Hataları & Çözümleri

### ❌ `'` can be escaped with `&apos;` (react/no-unescaped-entities)
JSX text içinde tek tırnak (`'`) kullanamazsın. Çözüm:

```tsx
// ❌ Yanlış
<button>Varsayılan preset'lere dön</button>

// ✅ Doğru
<button>Varsayılan preset&apos;lere dön</button>
// veya
<button>Varsayılan preset{'\''}lere dön</button>
```

### ❌ `Module not found` / import error
- `npm ci` çalıştırılmamış olabilir
- Path alias yanlış: `@/` → `./` (örn. `@/components/X` ✓)

### ❌ Type errors
```bash
npx tsc --noEmit
```
Hatayı oku, type'ı düzelt veya `// @ts-expect-error` ile geçici sus (NOT: production'a sızmasın).

### ⚠️ React hook deps warning
- CI'da fail OLMAZ (warning), ama log'da görünür
- İstersen düzelt, istemiyorsan biraraya getir: `// eslint-disable-next-line react-hooks/exhaustive-deps`

### ❌ Build sırasında "Out of memory"
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

---

## 🌳 Branch & PR Standartları

### Branch isimleri
- `feature/...` veya `feat/...` — yeni özellik
- `fix/...` — bug fix
- `refactor/...` — kod temizliği
- `docs/...` — sadece dokümantasyon
- `claude/...`, `cursor/...`, `copilot/...` — ajan-spesifik branch'ler de OK

### Commit mesajları (Conventional Commits)
```
feat(scope): kısa özet (mevcut zaman, küçük harf)

İlk satır 72 karakteri geçmesin.
Body opsiyonel — neden + nasıl.

Co-Authored-By: Agent Name <noreply@example.com>
```

Örnek:
```
feat(table): conditional formatting — kurala uyan satır renkli

5 hazır preset + kullanıcı tanımlı kural editörü. Excel pattern.

Co-Authored-By: Claude <noreply@anthropic.com>
```

### PR akışı (standart)
```bash
# 1. Doğrula
npm run verify

# 2. Commit
git add -A
git commit -m "..."

# 3. Push (pre-push hook çalışacak)
git push origin <branch>

# 4. PR aç (gh CLI)
gh pr create --title "..." --body "..."

# 5. CI yeşil olunca merge
gh pr merge <num> --squash --delete-branch=false
```

---

## 📁 Dizin Standardı

```
.
├── .github/workflows/    # CI/CD (ci.yml)
├── .githooks/            # Git hook'ları (pre-push vs.)
├── app/                  # Next.js App Router sayfaları
├── components/           # React component'leri
│   ├── ui/              # Reusable primitive (button, dialog, vb.)
│   ├── layout/          # Header, Sidebar, AppLayout
│   ├── motion/          # Framer Motion preset'leri
│   ├── guide/           # Kullanıcı rehberi
│   ├── print/           # Print/PDF layout
│   └── tasks-table/     # Canlı Tablo (42 dosya)
├── contexts/            # React context'ler (auth, settings, vb.)
├── hooks/               # Custom hook'lar
├── lib/                 # Yardımcı fonksiyonlar (saf TS)
├── public/              # Statik dosyalar
├── scripts/             # Shell script'leri (migration, hook setup)
├── types/               # Global type tanımları (permissions, tasks)
├── docs-content/        # Rehber MDX/markdown içerik (varsa)
└── docs/                # Geliştirici dökümantasyonu
```

### Yeni dosya nereye?
- **Tek sayfa için**: `app/<route>/page.tsx`
- **Reusable UI**: `components/ui/` (Radix wrap)
- **Domain logic**: `components/<domain>/` (örn. `tasks-table/`)
- **Saf TS/util**: `lib/`
- **Hook**: `hooks/use<Name>.ts`
- **Type**: `types/<name>.ts` veya component'in yanına `<Component>Types.ts`

---

## 🎨 Tasarım Sistemi (Tailwind + tokens)

### Renk tokens
- **Brand**: `--accent-*` CSS variable (kullanıcı yönetir, marka rengi)
- **Status**: `red` (overdue), `amber` (warning), `emerald` (success), `blue` (info), `violet` (premium), `slate` (neutral)
- **Dark mode**: Her sınıfın `dark:` karşılığı zorunlu (D1 audit kuralı)

### Animasyon
Tek noktadan: `components/motion/motionPresets.ts`
- `softSpring` — UI öğeleri
- `bouncySpring` — toast, badge
- `smoothEase` — liste/stagger
- `prefers-reduced-motion` her zaman respect et

### İkon
- `lucide-react` standart
- Boyut: `h-3 w-3` (xs) / `h-4 w-4` (sm) / `h-5 w-5` (md)

### Erişilebilirlik (a11y)
- Tüm interaktif öğelere `aria-label` veya `title`
- Form input'larına `<label>`
- Klavye navigation: Tab/Esc/Enter/←→ desteği
- Renk-tek ayırıcı kullanma (ikon + text de ekle)

---

## 🔐 Güvenlik & Veri

### Hassas alan (PII)
- TCKN, sicil, e-posta gibi alanlara `data-sensitive="true"` koy
- Print/PDF'te otomatik maskelenir (`@media print` globals.css)
- Export'ta `liveTable.exportSensitiveUnmasked` permission gerekli

### Permission kontrolü
- Her route/component yetki gerektiriyorsa `hasPermission("...")` kontrol et
- 60+ permission listesi: `types/permissions.ts`
- Roller: `admin` / `project_manager` / `member` / `viewer`

### Supabase
- Tüm DB mutation'lar RLS politikası ile korunur
- Yeni tablo eklerken RLS yazmadan production'a gönderme
- Migration script'leri `scripts/*.sql` veya `supabase/migrations/`

---

## 🚢 Deployment (Railway)

Otomatik:
- `main` branch'e push → Railway otomatik deploy
- ~2 dakika içinde production'da
- Build log: Railway dashboard

Manuel kontrol:
```bash
# Build başarılı mı (Railway öncesi)
npm run build
```

Env değişkenleri Railway dashboard'da yönetilir (`.env.local` git'e commit edilmez).

---

## 🤖 Çoklu Agent Kullanım Notları

### Aynı dosyaya farklı agent'lar dokunursa (conflict)
```bash
git fetch origin main
git merge origin/main --no-edit
# Conflict olursa elle çöz, sonra:
git add -A
git commit
git push
```

### Agent-spesifik notlar
- **Claude Code**: Bu dosyayı bağlam olarak okur. `CLAUDE.md` yok (varsa onu da güncelle).
- **Cursor**: `.cursorrules` veya `.cursor/rules/` aynı kuralları içermeli.
- **Copilot**: `.github/copilot-instructions.md` aynı kuralları içermeli.
- **Devin/Windsurf**: Bu `AGENTS.md` standartı kabul edilir.

### Hangi agent çalışırsa çalışsın **bu 3 kural** değişmez:
1. **`npm run verify`** push öncesi çalışmalı
2. **Conventional commit** mesajı kullan
3. **CI yeşil olmadan merge etme** (admin override hariç)

---

## 📋 Yardım & Sorun Giderme

| Sorun | Çözüm |
|---|---|
| CI sürekli fail | `npm run verify` çalıştır, hatayı düzelt |
| Pre-push hook çalışmıyor | `bash scripts/install-git-hooks.sh` tekrar çalıştır |
| Merge conflict | `git fetch origin main && git merge origin/main` |
| Build OOM | `NODE_OPTIONS="--max-old-space-size=4096" npm run build` |
| Eski cache | `rm -rf .next node_modules && npm ci` |

---

**Son güncelleme**: Bu dosyayı her büyük süreç değişikliğinde güncelle. CI yenisini kabul edene kadar PR'a gerek yok — direkt main'e push.
