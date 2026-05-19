"use client";

import { useEffect, useRef, useState } from "react";
import { UserCircle2, Upload, Loader2, Trash2, Save } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/modals";
import {
  getMyProfile,
  updateMyProfile,
  uploadAvatar,
  type UserProfile,
} from "@/lib/profile";

export default function ProfilPage() {
  const { user, isLoaded } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [nickname, setNickname] = useState("");
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const p = await getMyProfile();
        if (p) {
          setProfile(p);
          setNickname(p.nickname ?? "");
          setFullName(p.full_name ?? "");
          setTitle(p.title ?? "");
          setDepartment(p.department ?? "");
          setBio(p.bio ?? "");
          setAvatarUrl(p.avatar_url ?? null);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Profil yüklenemedi");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSave = async () => {
    if (bio.trim().length > 200) {
      toast.error("Bio en fazla 200 karakter olabilir.");
      return;
    }
    setSaving(true);
    try {
      await updateMyProfile({
        nickname,
        full_name: fullName,
        title,
        department,
        bio,
        avatar_url: avatarUrl,
      });
      toast.success("Profil güncellendi");
      const refreshed = await getMyProfile();
      if (refreshed) setProfile(refreshed);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const handleUploadClick = () => fileRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(f);
      setAvatarUrl(url);
      await updateMyProfile({ avatar_url: url });
      toast.success("Avatar güncellendi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yüklenemedi");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    const ok = await confirm({
      title: "Avatarı kaldır",
      message: "Avatar fotoğrafı kaldırılıp baş harf gösterimine dönülecek. Devam?",
      confirmLabel: "Kaldır",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      setAvatarUrl(null);
      await updateMyProfile({ avatar_url: null });
      toast.success("Avatar kaldırıldı");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaldırılamadı");
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex max-w-2xl items-center justify-center gap-2 px-6 py-16 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Yükleniyor…
      </div>
    );
  }

  if (!user) {
    return <div className="px-6 py-16 text-slate-600">Giriş yapmanız gerekir.</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumb items={[{ label: "Profilim" }]} />

      <header className="flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
        <UserCircle2 className="h-5 w-5 text-slate-500 dark:text-slate-400" aria-hidden />
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Profilim
        </h1>
      </header>

      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        {/* Sol: avatar + readonly bilgi */}
        <aside className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/40">
          <div className="flex justify-center">
            <UserAvatar
              avatarUrl={avatarUrl}
              nickname={nickname}
              fullName={fullName}
              email={user.email}
              className="h-32 w-32 text-3xl"
            />
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={(e) => void handleFileChange(e)}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUploadClick}
              disabled={uploading}
              className="gap-1.5"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" aria-hidden />
              )}
              {avatarUrl ? "Avatarı değiştir" : "Avatar yükle"}
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void handleRemoveAvatar()}
                className="gap-1.5 text-red-600 hover:text-red-700 dark:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Avatarı kaldır
              </Button>
            )}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            5 MB max · PNG/JPEG/GIF/WebP
          </p>
          <div className="mt-2 border-t border-slate-100 pt-3 dark:border-slate-700">
            <dl className="space-y-2 text-xs">
              <div>
                <dt className="text-slate-500 dark:text-slate-400">E-posta</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-200">{user.email}</dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Rol</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-200">
                  {profile?.role_id ?? "—"}
                </dd>
              </div>
            </dl>
          </div>
        </aside>

        {/* Sağ: düzenlenebilir alanlar */}
        <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/40">
          <Field label="Görünen ad (nickname)" hint="Yorumlarda ve online listesinde bu görünür.">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="örn. Uğur G."
              maxLength={50}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </Field>

          <Field label="Tam ad" hint="Resmi belgelerde / raporlarda görünür.">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ad Soyad"
              maxLength={100}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Unvan">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="örn. Yazılım Geliştirici"
                maxLength={80}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </Field>

            <Field label="Departman / Birim">
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="örn. IT / Operasyon"
                maxLength={80}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </Field>
          </div>

          <Field
            label="Kısa bio"
            hint={`${bio.length} / 200 karakter — başkalarının görebileceği kısa açıklama.`}
          >
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={200}
              placeholder="örn. Veri analizi ve raporlamadan sorumluyum."
              className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </Field>

          <div className="flex justify-end border-t border-slate-100 pt-3 dark:border-slate-700">
            <Button onClick={() => void handleSave()} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Kaydet
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>
      )}
    </div>
  );
}
