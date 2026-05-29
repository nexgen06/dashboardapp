"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useSettings } from "@/contexts/settings-context";
import type { PiiPolicyMode, PiiSensitiveDisplayMode } from "@/contexts/settings-context";
import { AlertTriangle, LogOut, Monitor, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { SettingRow } from "@/components/settings/SettingRow";
import { matchesSearch } from "@/components/settings/settingsSearch";

export function GuvenlikAyarlarPanel({ searchQuery }: { searchQuery: string }) {

  const { settings, updateSetting } = useSettings();
  const [activeSecurityPanel, setActiveSecurityPanel] = useState<"pii" | "hesap" | "oturum" | "tehlikeli">("pii");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<"idle" | "success" | "error">("idle");
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [sessions] = useState([
    { id: "1", device: "Chrome, macOS", location: "Bu cihaz", current: true, lastActive: "Şu an" },
    { id: "2", device: "Safari, iPhone", location: "İstanbul", current: false, lastActive: "2 saat önce" },
    { id: "3", device: "Chrome, Windows", location: "Ankara", current: false, lastActive: "1 gün önce" },
  ]);
  const [closedSessions, setClosedSessions] = useState<Set<string>>(new Set());
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [closeAccountOpen, setCloseAccountOpen] = useState(false);
  const [deleteAllChecked, setDeleteAllChecked] = useState(false);
  const [closeAccountChecked, setCloseAccountChecked] = useState(false);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMessage("error");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage("error");
      return;
    }
    setPasswordMessage("success");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const closeSession = (id: string) => setClosedSessions((prev) => new Set(prev).add(id));
  const closeAllOther = () => setClosedSessions(new Set(sessions.filter((s) => !s.current).map((s) => s.id)));
  const activeSessions = sessions.filter((s) => !closedSessions.has(s.id));
  const pwdMatch = matchesSearch(searchQuery, "Şifre değiştir", "Mevcut şifrenizi girip yeni şifre belirleyin.");
  const twoFaMatch = matchesSearch(searchQuery, "İki adımlı doğrulama (2FA)", "Hesabınıza girişte ek doğrulama kodu istenir.");
  const sessionMatch = matchesSearch(searchQuery, "Oturum yönetimi", "Açık cihazlar ve oturumları kapat.");
  const dangerMatch = matchesSearch(searchQuery, "Tehlikeli işlemler", "Geri alınamaz işlemler. Onay gerekir.");
  const piiLimitMatch = matchesSearch(searchQuery, "PII kopyalama limiti", "TCKN/Sicil gibi hassas alanlar için saatlik kopyalama eşiği.");
  const piiPolicyModeMatch = matchesSearch(
    searchQuery,
    "PII policy modu",
    "shadow sadece loglar, enforce deny kararını uygular."
  );
  const piiSensitiveDisplayModeMatch = matchesSearch(
    searchQuery,
    "Hassas hücre görünümü",
    "hassas alanlar Gizli (kopyala) veya maskeli değer şeklinde gösterilir."
  );
  const hasSearch = searchQuery.trim().length > 0;
  const noneMatch = searchQuery.trim() && !pwdMatch && !twoFaMatch && !sessionMatch && !dangerMatch && !piiLimitMatch && !piiPolicyModeMatch && !piiSensitiveDisplayModeMatch;

  return (
    <div className="space-y-2">
      <p className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        <strong className="font-semibold">Önizleme:</strong> Aşağıdaki şifre, 2FA ve oturum örnekleri henüz Supabase ile bağlı değildir; arayüz demonstrasyonudur.
      </p>
      {!hasSearch && (
        <div className="mb-1 flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={() => setActiveSecurityPanel("pii")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              activeSecurityPanel === "pii"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
            )}
          >
            PII ve Koruma
          </button>
          <button
            type="button"
            onClick={() => setActiveSecurityPanel("hesap")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              activeSecurityPanel === "hesap"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
            )}
          >
            Hesap Güvenliği
          </button>
          <button
            type="button"
            onClick={() => setActiveSecurityPanel("oturum")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              activeSecurityPanel === "oturum"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
            )}
          >
            Oturumlar
          </button>
          <button
            type="button"
            onClick={() => setActiveSecurityPanel("tehlikeli")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              activeSecurityPanel === "tehlikeli"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
            )}
          >
            Tehlikeli İşlemler
          </button>
        </div>
      )}
      {(hasSearch ? pwdMatch : activeSecurityPanel === "hesap") && (
      <SettingRow label="Şifre değiştir" description="Mevcut şifrenizi girip yeni şifre belirleyin.">
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3 max-w-sm">
          <input
            type="password"
            placeholder="Mevcut şifre"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          <input
            type="password"
            placeholder="Yeni şifre"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          <input
            type="password"
            placeholder="Yeni şifre (tekrar)"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          {passwordMessage === "success" && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">Şifre güncelleme isteği alındı. (Demo: gerçek uygulamada API çağrılır.)</p>
          )}
          {passwordMessage === "error" && (
            <p className="text-xs text-red-600 dark:text-red-400">Şifreler eşleşmiyor veya en az 8 karakter olmalı.</p>
          )}
          <Button type="submit" size="sm" className="w-fit bg-blue-600 hover:bg-blue-700">
            Şifreyi güncelle
          </Button>
        </form>
      </SettingRow>
      )}
      {(hasSearch ? twoFaMatch : activeSecurityPanel === "hesap") && (
      <SettingRow
        label="İki adımlı doğrulama (2FA)"
        description="Hesabınıza girişte ek doğrulama kodu istenir."
      >
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={twoFaEnabled}
            onChange={(e) => setTwoFaEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">2FA kullan</span>
        </label>
        {twoFaEnabled && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Authenticator uygulaması veya SMS ile doğrulama kodu yapılandırılır. (Demo)
          </p>
        )}
      </SettingRow>
      )}
      {(hasSearch ? sessionMatch : activeSecurityPanel === "oturum") && (
      <SettingRow
        label="Oturum yönetimi"
        description="Açık cihazlar ve oturumları kapat."
      >
        <div className="space-y-3">
          {activeSessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-slate-600 dark:bg-slate-700/50"
            >
              <div className="flex items-center gap-3">
                {s.current ? (
                  <Monitor className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                ) : (
                  <Smartphone className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                )}
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{s.device}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{s.location} · {s.lastActive}</p>
                </div>
                {s.current && (
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">Bu cihaz</span>
                )}
              </div>
              {!s.current && (
                <Button type="button" variant="outline" size="sm" onClick={() => closeSession(s.id)}>
                  <LogOut className="mr-1 h-3.5 w-3.5" />
                  Oturumu kapat
                </Button>
              )}
            </div>
          ))}
          {activeSessions.some((s) => !s.current) && (
            <Button type="button" variant="outline" size="sm" onClick={closeAllOther} className="border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/30">
              <LogOut className="mr-2 h-4 w-4" />
              Tüm diğer oturumları kapat
            </Button>
          )}
        </div>
      </SettingRow>
      )}
      {(hasSearch ? piiLimitMatch : activeSecurityPanel === "pii") && (
      <SettingRow
        label="PII kopyalama limiti"
        description="TCKN/Sicil gibi hassas alanlar için bir kullanıcının saatlik kopyalama eşiği. Aşılırsa kopya engellenir ve admin'e alarm yansır. 0 = limit yok."
      >
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={9999}
            value={settings.piiCopyHourlyLimit}
            onChange={(e) => {
              const n = Number(e.target.value);
              updateSetting("piiCopyHourlyLimit", Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);
            }}
            className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">kopya / saat</span>
        </div>
      </SettingRow>
      )}
      {(hasSearch ? piiPolicyModeMatch : activeSecurityPanel === "pii") && (
      <SettingRow
        label="PII policy modu (copy)"
        description="shadow: sadece karar farklarını loglar. enforce: deny kararı olan hassas kopyalama isteklerini bloklar."
      >
        <select
          value={settings.piiPolicyMode}
          onChange={(e) => updateSetting("piiPolicyMode", e.target.value as PiiPolicyMode)}
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        >
          <option value="shadow">shadow (önerilen başlangıç)</option>
          <option value="enforce">enforce (deny uygula)</option>
        </select>
      </SettingRow>
      )}
      {(hasSearch ? piiSensitiveDisplayModeMatch : activeSecurityPanel === "pii") && (
      <SettingRow
        label="Hassas hücre görünümü"
        description="Süper admin dışı kullanıcılar için hassas hücrelerin arayüzde nasıl gösterileceğini belirler."
      >
        <select
          value={settings.piiSensitiveDisplayMode}
          onChange={(e) => updateSetting("piiSensitiveDisplayMode", e.target.value as PiiSensitiveDisplayMode)}
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        >
          <option value="hidden_copy">Gizli (kopyala)</option>
          <option value="masked_copy">Maskeli değer + kopyala</option>
        </select>
      </SettingRow>
      )}
      {(hasSearch ? dangerMatch : activeSecurityPanel === "tehlikeli") && (
      <SettingRow
        label="Tehlikeli işlemler"
        description="Geri alınamaz işlemler. Onay modalı ve checkbox ile onaylanır."
      >
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { setDeleteAllOpen(true); setDeleteAllChecked(false); }}
            className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/30"
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Tüm verileri sil
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { setCloseAccountOpen(true); setCloseAccountChecked(false); }}
            className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/30"
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Hesabı kapat
          </Button>
        </div>
      </SettingRow>
      )}
      <Dialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
        <DialogContent showClose={true}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-5 w-5" />
              Tüm verileri sil
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Tüm verileriniz kalıcı olarak silinecek. Bu işlem geri alınamaz.
          </p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={deleteAllChecked}
              onChange={(e) => setDeleteAllChecked(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Tüm verilerimin silineceğini anlıyorum.</span>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteAllOpen(false)}>İptal</Button>
            <Button
              type="button"
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!deleteAllChecked}
              onClick={() => { setDeleteAllOpen(false); setDeleteAllChecked(false); /* demo */ }}
            >
              Tümünü sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={closeAccountOpen} onOpenChange={setCloseAccountOpen}>
        <DialogContent showClose={true}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-5 w-5" />
              Hesabı kapat
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Hesabınız kapatılacak ve tüm verileriniz silinecek. Bu işlem geri alınamaz.
          </p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={closeAccountChecked}
              onChange={(e) => setCloseAccountChecked(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Hesabımın kapatılacağını ve verilerimin silineceğini anlıyorum.</span>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCloseAccountOpen(false)}>İptal</Button>
            <Button
              type="button"
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!closeAccountChecked}
              onClick={() => { setCloseAccountOpen(false); setCloseAccountChecked(false); /* demo */ }}
            >
              Hesabı kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {noneMatch && <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Arama kriterine uyan ayar yok.</p>}
    </div>
  );
}
