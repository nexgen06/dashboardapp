# Supabase Realtime – Çoklu Kullanıcı Anlık Senkron

Birden fazla kullanıcının yaptığı değişikliklerin sayfa yenilemeden yansıması için **Realtime** açık olmalı.

---

## Yöntem 1: SQL ile Ekleme (Önerilen)

1. **Supabase Dashboard** → [supabase.com/dashboard](https://supabase.com/dashboard) → Projenizi seçin.
2. Sol menüden **SQL Editor** açın.
3. Aşağıdaki sorguyu yapıştırıp **Run** (veya F5) ile çalıştırın.

```sql
-- Realtime publication'a tasks ve projects tablolarını ekle
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
```

4. Tablo zaten ekliyse `already member of publication` benzeri bir uyarı alabilirsiniz; yok sayabilirsiniz.
5. Ekledikten sonra uygulamada sayfayı yenileyin; birden fazla kullanıcının değişiklikleri anında yansıyacaktır.

**Kontrol (hangi tablolar eklendi görmek için):**

```sql
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
```

Çıktıda `public.tasks` ve `public.projects` görünmeli.

---

## Yöntem 2: Dashboard arayüzü ile

1. **Supabase Dashboard** → Projeniz → **Database** → **Replication**.
2. **supabase_realtime** publication’ını bulun (veya **Create publication** ile oluşturun; genelde zaten vardır).
3. **Add table** / **Tables in publication** bölümünde **Add table** butonuna tıklayın.
4. Listeden **public.tasks** seçin → ekleyin.
5. Tekrar **Add table** → **public.projects** seçin → ekleyin.
6. Kaydedin.

Arayüz sürüme göre **Database** → **Replication** altında “0 tables” veya tablo listesi şeklinde olabilir; **Add table** / **Enable** ile `public.tasks` ve `public.projects` ekleyin.

## Uygulama Tarafı

- **Görevler:** `useTasksWithRealtime` hook’u `tasks` tablosuna `postgres_changes` ile abone. INSERT/UPDATE/DELETE anında state’e yansır.
- **Projeler:** `useProjects` hook’u `projects` tablosuna Realtime abonesi. Proje ekleme/güncelleme/silme anında listeye yansır.
- **Sekme odak:** Kullanıcı sekmesine geri dönünce (focus) bir kez veri tekrar çekilir; Realtime bir olay kaçırsa bile liste güncel kalır.

## Hâlâ Yansımıyorsa

1. Tarayıcı konsolunda `[Tasks] Realtime:` veya `[Projects] Realtime:` uyarısı var mı bakın.
2. Supabase **Database > Replication**’da `tasks` ve `projects` gerçekten ekli mi kontrol edin.
3. RLS (Row Level Security) kullanıyorsanız, Realtime olayları da aynı RLS kurallarına tabidir; kullanıcının görebildiği satırlar için olay gelir.
