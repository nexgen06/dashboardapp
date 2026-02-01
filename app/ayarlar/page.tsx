"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useSettings } from "@/contexts/settings-context";
import type { Theme, Language, DateFormat, LogLevel, SettingsSection } from "@/contexts/settings-context";
import { Settings2, Globe, Palette, Bell, RotateCcw, Check, Shield, Key, Zap, LogOut, Monitor, Smartphone, Search, AlertTriangle, Trash2, Loader2, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";

function matchesSearch(query: string, label: string, description?: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return label.toLowerCase().includes(q) || (description?.toLowerCase().includes(q) ?? false);
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 py-4 border-b border-slate-100 last:border-0 dark:border-slate-700">
      <label className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</label>
      {description && (
        <p className="text-xs text-slate-500 mb-2 dark:text-slate-400" title="Ne işe yarar / ne zaman kullanılır">{description}</p>
      )}
      {children}
    </div>
  );
}

function GenelAyarlar({ searchQuery, resetSection }: { searchQuery: string; resetSection: (s: SettingsSection) => void }) {
  const { settings, updateSetting } = useSettings();

  return (
    <div className="space-y-2">
      {matchesSearch(searchQuery, "Dil", "Arayüz dilini seçin.") && (
      <SettingRow
        label="Dil"
        description="Arayüz dilini seçin. Tüm etiket ve mesajlar bu dile göre gösterilir."
      >
        <select
          value={settings.language}
          onChange={(e) => updateSetting("language", e.target.value as Language)}
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        >
          <option value="tr">Türkçe</option>
          <option value="en">English</option>
        </select>
      </SettingRow>
      )}
      {matchesSearch(searchQuery, "Tarih formatı", "Tarihlerin gösterim şekli.") && (
      <SettingRow
        label="Tarih formatı"
        description="Tarihlerin gösterim şekli. Tablolarda ve bildirimlerde kullanılır."
      >
        <select
          value={settings.dateFormat}
          onChange={(e) => updateSetting("dateFormat", e.target.value as DateFormat)}
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        >
          <option value="DD.MM.YYYY">GG.AA.YYYY (31.12.2025)</option>
          <option value="YYYY-MM-DD">YYYY-AA-GG (2025-12-31)</option>
          <option value="MM/DD/YYYY">AA/GG/YYYY (12/31/2025)</option>
        </select>
      </SettingRow>
      )}
      {searchQuery.trim() && !matchesSearch(searchQuery, "Dil", "Arayüz dilini seçin.") && !matchesSearch(searchQuery, "Tarih formatı", "Tarihlerin gösterim şekli.") && (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Arama kriterine uyan ayar yok.</p>
      )}
      <div className="pt-4">
        <Button type="button" variant="outline" size="sm" onClick={() => resetSection("genel")} className="text-slate-600 dark:text-slate-400">
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
          Bu bölümü varsayılana sıfırla
        </Button>
      </div>
    </div>
  );
}

function GorusAyarlar({ searchQuery, resetSection }: { searchQuery: string; resetSection: (s: SettingsSection) => void }) {
  const { settings, updateSetting } = useSettings();

  const themeMatch = matchesSearch(searchQuery, "Tema", "Açık, koyu veya sistem ayarına göre.");
  const sidebarMatch = matchesSearch(searchQuery, "Sidebar varsayılan", "Sayfa açıldığında sidebar dar mı açık mı olsun.");
  const noneMatch = searchQuery.trim() && !themeMatch && !sidebarMatch;

  return (
    <div className="space-y-2">
      {themeMatch && (
      <SettingRow
        label="Tema"
        description="Açık, koyu veya sistem ayarına göre. Göz yorgunluğunu azaltmak için koyu mod kullanılabilir."
      >
        <select
          value={settings.theme}
          onChange={(e) => updateSetting("theme", e.target.value as Theme)}
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        >
          <option value="light">Açık</option>
          <option value="dark">Koyu</option>
          <option value="system">Sisteme uy</option>
        </select>
      </SettingRow>
      )}
      {sidebarMatch && (
      <SettingRow
        label="Sidebar varsayılan"
        description="Sayfa açıldığında sidebar dar mı açık mı olsun."
      >
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.sidebarCollapsedByDefault}
            onChange={(e) => updateSetting("sidebarCollapsedByDefault", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">Varsayılan olarak daraltılmış</span>
        </label>
      </SettingRow>
      )}
      {noneMatch && <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Arama kriterine uyan ayar yok.</p>}
      <div className="pt-4">
        <Button type="button" variant="outline" size="sm" onClick={() => resetSection("gorunum")} className="text-slate-600 dark:text-slate-400">
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
          Bu bölümü varsayılana sıfırla
        </Button>
      </div>
    </div>
  );
}

function BildirimAyarlar({ searchQuery, resetSection }: { searchQuery: string; resetSection: (s: SettingsSection) => void }) {
  const { settings, updateSetting } = useSettings();

  const emailMatch = matchesSearch(searchQuery, "E-posta bildirimleri", "Önemli olaylarda e-posta alın.");
  const pushMatch = matchesSearch(searchQuery, "Tarayıcı bildirimleri", "Push bildirimleri (tarayıcı izni gerekir).");
  const soundMatch = matchesSearch(searchQuery, "Ses", "Yeni bildirimde ses çalsın.");
  const noneMatch = searchQuery.trim() && !emailMatch && !pushMatch && !soundMatch;

  return (
    <div className="space-y-2">
      {emailMatch && (
      <SettingRow
        label="E-posta bildirimleri"
        description="Önemli olaylarda e-posta alın. Görev atamaları ve hatırlatmalar için kullanılır."
      >
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.notificationsEmail}
            onChange={(e) => updateSetting("notificationsEmail", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">E-posta bildirimlerini aç</span>
        </label>
      </SettingRow>
      )}
      {pushMatch && (
      <SettingRow
        label="Tarayıcı bildirimleri"
        description="Push bildirimleri (tarayıcı izni gerekir)."
      >
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.notificationsPush}
            onChange={(e) => updateSetting("notificationsPush", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">Push bildirimlerini aç</span>
        </label>
      </SettingRow>
      )}
      {soundMatch && (
      <SettingRow
        label="Ses"
        description="Yeni bildirimde ses çalsın."
      >
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.notificationsSound}
            onChange={(e) => updateSetting("notificationsSound", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">Bildirim sesini aç</span>
        </label>
      </SettingRow>
      )}
      {noneMatch && <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Arama kriterine uyan ayar yok.</p>}
      <div className="pt-4">
        <Button type="button" variant="outline" size="sm" onClick={() => resetSection("bildirimler")} className="text-slate-600 dark:text-slate-400">
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
          Bu bölümü varsayılana sıfırla
        </Button>
      </div>
    </div>
  );
}

function GuvenlikAyarlar({ searchQuery }: { searchQuery: string }) {
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
  const noneMatch = searchQuery.trim() && !pwdMatch && !twoFaMatch && !sessionMatch && !dangerMatch;

  return (
    <div className="space-y-2">
      {pwdMatch && (
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
      {twoFaMatch && (
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
      {sessionMatch && (
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
      {matchesSearch(searchQuery, "Tehlikeli işlemler", "Geri alınamaz işlemler. Onay gerekir.") && (
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

function EntegrasyonlarAyarlar({ searchQuery }: { searchQuery: string }) {
  const [apiKeys, setApiKeys] = useState([{ id: "1", name: "Canlı tablo API", masked: "sk_live_••••••••••••xyz" }]);
  const [webhooks, setWebhooks] = useState([
    { id: "1", url: "https://api.example.com/••••••••/webhook", description: "Görev güncellemeleri" },
  ]);
  const [showNewKey, setShowNewKey] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");

  const addKey = () => {
    setApiKeys((prev) => [...prev, { id: String(Date.now()), name: "Yeni anahtar", masked: "sk_live_••••••••••••" + Math.random().toString(36).slice(-4) }]);
    setShowNewKey(false);
  };
  const removeKey = (id: string) => setApiKeys((prev) => prev.filter((k) => k.id !== id));
  const addWebhook = () => {
    if (!newWebhookUrl.trim()) return;
    setWebhooks((prev) => [...prev, { id: String(Date.now()), url: newWebhookUrl.trim(), description: "Yeni webhook" }]);
    setNewWebhookUrl("");
  };
  const removeWebhook = (id: string) => setWebhooks((prev) => prev.filter((w) => w.id !== id));
  const apiMatch = matchesSearch(searchQuery, "API anahtarları", "Harici uygulamalarda kullanılan anahtarlar. Maskeli gösterim.");
  const webhookMatch = matchesSearch(searchQuery, "Webhook URL'leri", "Olay bildirimleri için endpoint adresleri. Maskeli gösterim.");
  const noneMatch = searchQuery.trim() && !apiMatch && !webhookMatch;

  return (
    <div className="space-y-2">
      {apiMatch && (
      <SettingRow
        label="API anahtarları"
        description="Harici uygulamalarda kullanılan anahtarlar. Maskeli gösterim."
      >
        <div className="space-y-3">
          {apiKeys.map((k) => (
            <div key={k.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-slate-600 dark:bg-slate-700/50">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span className="font-mono text-sm text-slate-700 dark:text-slate-300">{k.masked}</span>
              </div>
              <Button type="button" variant="ghost" size="sm" className="text-slate-600 hover:text-red-600" onClick={() => removeKey(k.id)}>
                Kaldır
              </Button>
            </div>
          ))}
          {showNewKey ? (
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={addKey} className="bg-blue-600 hover:bg-blue-700">
                Anahtar oluştur (demo)
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowNewKey(false)}>İptal</Button>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setShowNewKey(true)}>
              <Key className="mr-2 h-4 w-4" />
              Yeni API anahtarı
            </Button>
          )}
        </div>
      </SettingRow>
      )}
      {webhookMatch && (
      <SettingRow
        label="Webhook URL'leri"
        description="Olay bildirimleri için endpoint adresleri. Maskeli gösterim."
      >
        <div className="space-y-3">
          {webhooks.map((w) => (
            <div key={w.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-slate-600 dark:bg-slate-700/50">
              <div>
                <p className="font-mono text-sm text-slate-700 dark:text-slate-300">{w.url}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{w.description}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" className="text-slate-600 hover:text-red-600" onClick={() => removeWebhook(w.id)}>
                Kaldır
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://..."
              value={newWebhookUrl}
              onChange={(e) => setNewWebhookUrl(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
            <Button type="button" size="sm" onClick={addWebhook} disabled={!newWebhookUrl.trim()} className="bg-blue-600 hover:bg-blue-700">
              Ekle
            </Button>
          </div>
        </div>
      </SettingRow>
      )}
      {noneMatch && <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Arama kriterine uyan ayar yok.</p>}
    </div>
  );
}

function GelismisAyarlar({ searchQuery, resetSection, resetToDefaults }: { searchQuery: string; resetSection: (s: SettingsSection) => void; resetToDefaults: () => void }) {
  const { settings, updateSetting } = useSettings();
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  const debugMatch = matchesSearch(searchQuery, "Debug modu", "Geliştirici konsolunda ek loglar.");
  const logMatch = matchesSearch(searchQuery, "Log seviyesi", "Uygulama loglarının ayrıntı düzeyi.");
  const expMatch = matchesSearch(searchQuery, "Deneysel özellikler", "Henüz kararlı olmayan özellikleri etkinleştirir.");
  const resetMatch = matchesSearch(searchQuery, "Veritabanı sıfırla", "Tüm projeleri, görevleri ve ayarları sıfırla.");
  const noneMatch = searchQuery.trim() && !debugMatch && !logMatch && !expMatch && !resetMatch;

  const handleFullReset = async () => {
    if (resetConfirmText !== "SIFIRLA") return;
    
    setIsResetting(true);
    setResetError(null);
    
    try {
      // 1. Tüm görevleri sil
      const { error: tasksError } = await supabase
        .from("tasks")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Tüm kayıtları sil
      
      if (tasksError) throw new Error(`Görevler silinemedi: ${tasksError.message}`);
      
      // 2. Tüm projeleri sil
      const { error: projectsError } = await supabase
        .from("projects")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Tüm kayıtları sil
      
      if (projectsError) throw new Error(`Projeler silinemedi: ${projectsError.message}`);
      
      // 3. Ayarları sıfırla
      resetToDefaults();
      
      // 4. localStorage temizle (ek veriler için)
      if (typeof window !== "undefined") {
        const keysToKeep = ["supabase.auth.token"]; // Auth token'ı koru
        Object.keys(localStorage).forEach((key) => {
          if (!keysToKeep.some((k) => key.includes(k))) {
            localStorage.removeItem(key);
          }
        });
      }
      
      setResetSuccess(true);
      setTimeout(() => {
        setResetDialogOpen(false);
        setResetSuccess(false);
        setResetConfirmText("");
        // Sayfayı yenile
        window.location.reload();
      }, 1500);
      
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-2">
      {debugMatch && (
      <SettingRow label="Debug modu" description="Geliştirici konsolunda ek loglar.">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.debugMode}
            onChange={(e) => updateSetting("debugMode", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">Debug modunu aç</span>
        </label>
      </SettingRow>
      )}
      {logMatch && (
      <SettingRow label="Log seviyesi" description="Uygulama loglarının ayrıntı düzeyi.">
        <select
          value={settings.logLevel}
          onChange={(e) => updateSetting("logLevel", e.target.value as LogLevel)}
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        >
          <option value="error">Hata (error)</option>
          <option value="warn">Uyarı (warn)</option>
          <option value="info">Bilgi (info)</option>
          <option value="debug">Debug</option>
        </select>
      </SettingRow>
      )}
      {expMatch && (
      <SettingRow
        label="Deneysel özellikler"
        description="Henüz kararlı olmayan özellikleri etkinleştirir."
      >
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-3">
            Risk: Deneysel özellikler beklenmeyen davranışlara veya veri kaybına yol açabilir. Sadece test ortamında kullanın.
          </p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.experimentalFeatures}
              onChange={(e) => updateSetting("experimentalFeatures", e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Deneysel özellikleri aç</span>
          </label>
        </div>
      </SettingRow>
      )}

      {/* Veritabanı Sıfırlama */}
      {resetMatch && (
      <SettingRow
        label="Veritabanı sıfırla"
        description="Tüm projeleri, görevleri ve ayarları kalıcı olarak siler."
      >
        <div className="rounded-lg border-2 border-red-200 bg-red-50/50 p-4 dark:border-red-700 dark:bg-red-900/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                Tehlikeli Bölge
              </p>
              <p className="text-xs text-red-700 dark:text-red-300 mb-4">
                Bu işlem veritabanındaki tüm projeleri, görevleri ve ayarları kalıcı olarak siler. 
                Bu eylem geri alınamaz!
              </p>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setResetDialogOpen(true)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Database className="mr-2 h-4 w-4" />
                Tüm verileri sıfırla
              </Button>
            </div>
          </div>
        </div>
      </SettingRow>
      )}

      {noneMatch && <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Arama kriterine uyan ayar yok.</p>}
      <div className="pt-4">
        <Button type="button" variant="outline" size="sm" onClick={() => resetSection("gelismis")} className="text-slate-600 dark:text-slate-400">
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
          Bu bölümü varsayılana sıfırla
        </Button>
      </div>

      {/* Sıfırlama Onay Modalı */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Tüm Verileri Sıfırla
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/30">
              <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-2">
                Bu işlem şunları kalıcı olarak silecek:
              </p>
              <ul className="text-sm text-red-700 dark:text-red-300 list-disc list-inside space-y-1">
                <li>Tüm projeler</li>
                <li>Tüm görevler</li>
                <li>Tüm uygulama ayarları</li>
                <li>Yerel depolama verileri</li>
              </ul>
            </div>
            
            {resetError && (
              <div className="rounded-lg border border-red-300 bg-red-100 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/50 dark:text-red-200">
                <strong>Hata:</strong> {resetError}
              </div>
            )}
            
            {resetSuccess && (
              <div className="rounded-lg border border-emerald-300 bg-emerald-100 p-3 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200 flex items-center gap-2">
                <Check className="h-4 w-4" />
                Tüm veriler başarıyla silindi! Sayfa yenileniyor...
              </div>
            )}
            
            {!resetSuccess && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Onaylamak için <span className="font-bold text-red-600">SIFIRLA</span> yazın:
                  </label>
                  <input
                    type="text"
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    placeholder="SIFIRLA"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    disabled={isResetting}
                  />
                </div>
                
                <DialogFooter className="gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setResetDialogOpen(false);
                      setResetConfirmText("");
                      setResetError(null);
                    }}
                    disabled={isResetting}
                  >
                    İptal
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleFullReset}
                    disabled={resetConfirmText !== "SIFIRLA" || isResetting}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isResetting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Siliniyor...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Kalıcı olarak sil
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AyarlarPage() {
  const { isDirty, save, resetToDefaults, resetSection, lastSavedAt } = useSettings();
  const [showToast, setShowToast] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (lastSavedAt == null) return;
    setShowToast(true);
    const t = setTimeout(() => setShowToast(false), 2000);
    return () => clearTimeout(t);
  }, [lastSavedAt]);

  return (
    <div className="max-w-3xl relative">
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-lg dark:border-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
          <Check className="h-4 w-4 shrink-0" />
          Kaydedildi
        </div>
      )}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">Ayarlar</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Genel, görünüm, bildirim ve güvenlik tercihlerinizi sekmelerden yönetin. Değişiklikler otomatik kaydedilir; kritik ayarlar (şifre, 2FA) için forma özel Kaydet kullanın.
        </p>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="text"
          placeholder="Ayarlarda ara"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      <Tabs defaultValue="genel" className="w-full">
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger value="genel" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
            <Globe className="mr-2 h-4 w-4" />
            Genel
          </TabsTrigger>
          <TabsTrigger value="gorunum" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
            <Palette className="mr-2 h-4 w-4" />
            Görünüm
          </TabsTrigger>
          <TabsTrigger value="bildirimler" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
            <Bell className="mr-2 h-4 w-4" />
            Bildirimler
          </TabsTrigger>
          <TabsTrigger value="guvenlik" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
            <Shield className="mr-2 h-4 w-4" />
            Güvenlik
          </TabsTrigger>
          <TabsTrigger value="entegrasyonlar" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
            <Key className="mr-2 h-4 w-4" />
            Entegrasyonlar
          </TabsTrigger>
          <TabsTrigger value="gelismis" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
            <Zap className="mr-2 h-4 w-4" />
            Gelişmiş
          </TabsTrigger>
        </TabsList>

        <TabsContent value="genel" className="mt-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <GenelAyarlar searchQuery={searchQuery} resetSection={resetSection} />
          </div>
        </TabsContent>
        <TabsContent value="gorunum" className="mt-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <GorusAyarlar searchQuery={searchQuery} resetSection={resetSection} />
          </div>
        </TabsContent>
        <TabsContent value="bildirimler" className="mt-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <BildirimAyarlar searchQuery={searchQuery} resetSection={resetSection} />
          </div>
        </TabsContent>
        <TabsContent value="guvenlik" className="mt-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <GuvenlikAyarlar searchQuery={searchQuery} />
          </div>
        </TabsContent>
        <TabsContent value="entegrasyonlar" className="mt-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <EntegrasyonlarAyarlar searchQuery={searchQuery} />
          </div>
        </TabsContent>
        <TabsContent value="gelismis" className="mt-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <GelismisAyarlar searchQuery={searchQuery} resetSection={resetSection} resetToDefaults={resetToDefaults} />
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6 dark:border-slate-700">
        <Button
          onClick={save}
          disabled={!isDirty}
          variant="outline"
          size="sm"
          className={cn(isDirty && "border-blue-300 text-blue-700 dark:border-blue-600 dark:text-blue-300")}
        >
          <Settings2 className="mr-2 h-4 w-4" />
          Şimdi kaydet
        </Button>
        <Button
          variant="outline"
          onClick={resetToDefaults}
          className="text-slate-700 dark:text-slate-300"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Tüm ayarları varsayılana sıfırla
        </Button>
        {isDirty && (
          <span className="text-sm text-slate-500 dark:text-slate-400">Kaydedilmemiş değişiklikler var (otomatik kayıt ~1 sn).</span>
        )}
      </div>
    </div>
  );
}
