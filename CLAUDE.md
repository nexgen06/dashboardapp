# Claude Code — Çalışma Notları

> **Bu repo'da tek kural seti vardır: [AGENTS.md](./AGENTS.md). Tüm kod ajanları (Claude Code, Cursor, Copilot, vb.) o dosyaya uyar.**

Aşağıdakiler Claude Code'a özel kısa hatırlatmalar:

## Push Öncesi Mutlaka Yap

```bash
npm run verify
```

Bu komut: `typecheck → lint → test → build` zincirini çalıştırır. CI'nın aynısı.

## Conventional Commit

```
feat(scope): kısa özet

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Önemli Dizinler

- `app/` — Next.js sayfaları
- `components/tasks-table/` — Canlı Tablo (42 dosya, dokunmadan önce ilgili hook'a bak)
- `hooks/` — Custom React hook'lar (use*.ts)
- `lib/` — Saf TS yardımcılar
- `types/permissions.ts` — Rol & izin sistemi

## Asla Yapma

- ❌ Direkt main'e push (PR aç)
- ❌ `git push --no-verify` (acil olmadıkça)
- ❌ Lint error'ı görmezden gel
- ❌ Yeni dependency eklerken `--no-save` (kalıcı kalsın)
- ❌ Production secret'ı commit (`.env.local` git ignored)

## Sık Kullandığın Pattern'ler (mevcut)

- **Motion**: `components/motion/motionPresets.ts` (softSpring, bouncySpring)
- **Toast undo**: `useToast()` + 6sn `durationMs` + `action: { label, onClick }`
- **Permission gate**: `hasPermission("liveTable.editTask")`
- **Settings**: `useSettings()` (theme, accentColor, brandColor, vs.)
- **Realtime**: `useTasksWithRealtime()` + `usePresence()`

## Detay

Tüm detaylar [AGENTS.md](./AGENTS.md)'de.
