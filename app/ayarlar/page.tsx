"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/contexts/settings-context";
import { useAuth } from "@/contexts/auth-context";
import {
  Settings2,
  Globe,
  Palette,
  Bell,
  RotateCcw,
  Check,
  Shield,
  Key,
  Zap,
  Search,
  Loader2,
  ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GenelAyarlarPanel } from "@/components/settings/GenelAyarlarPanel";
import { GorusAyarlarPanel } from "@/components/settings/GorusAyarlarPanel";
import { BildirimAyarlarPanel } from "@/components/settings/BildirimAyarlarPanel";
import { GorevlerAyarlarPanel } from "@/components/settings/GorevlerAyarlarPanel";
import { GuvenlikAyarlarPanel } from "@/components/settings/GuvenlikAyarlarPanel";
import { EntegrasyonlarAyarlarPanel } from "@/components/settings/EntegrasyonlarAyarlarPanel";
import { GelismisAyarlarPanel } from "@/components/settings/GelismisAyarlarPanel";

export default function AyarlarPage() {
  const { isDirty, save, resetToDefaults, resetSection, lastSavedAt } = useSettings();
  const { isAdmin, hasPermission, isLoaded } = useAuth();
  const canAccessSettings =
    isLoaded && hasPermission("area.settings") && hasPermission("settings.view");
  const canEditSettings = hasPermission("settings.edit");
  const [showToast, setShowToast] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (lastSavedAt == null) return;
    setShowToast(true);
    const t = setTimeout(() => setShowToast(false), 2000);
    return () => clearTimeout(t);
  }, [lastSavedAt]);

  if (!isLoaded) {
    return (
      <div className="flex max-w-3xl flex-col items-center justify-center gap-3 py-16 text-slate-500 dark:text-slate-400">
        <Loader2 className="h-10 w-10 animate-spin" aria-hidden />
        <p className="text-sm">Yükleniyor…</p>
      </div>
    );
  }

  if (!canAccessSettings) {
    return (
      <div className="max-w-2xl rounded-lg border-2 border-amber-200 bg-amber-50 p-8 dark:border-amber-800 dark:bg-amber-950/40">
        <div className="flex items-start gap-3">
          <Shield className="h-10 w-10 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Ayarlar görüntülenemez</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Bu sayfa için <code className="text-xs">area.settings</code> ve{" "}
              <code className="text-xs">settings.view</code> yetkileri gerekir.
            </p>
          </div>
        </div>
      </div>
    );
  }

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
          Genel, görünüm, bildirim ve güvenlik tercihlerinizi sekmelerden yönetin. Değişiklikler otomatik kaydedilir;
          kritik ayarlar (şifre, 2FA) için forma özel Kaydet kullanın.
        </p>
        {!canEditSettings && (
          <p
            role="status"
            className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
          >
            Bu rol ile ayar değişikliği yapılamaz. Görüntüleme için yeterli yetkiniz var.
          </p>
        )}
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
        <TabsList className="bg-slate-100 p-1 dark:bg-slate-800">
          <TabsTrigger value="genel" className="text-slate-600 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm dark:text-slate-300 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-blue-400">
            <Globe className="mr-2 h-4 w-4" />
            Genel
          </TabsTrigger>
          <TabsTrigger value="gorunum" className="text-slate-600 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm dark:text-slate-300 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-blue-400">
            <Palette className="mr-2 h-4 w-4" />
            Görünüm
          </TabsTrigger>
          <TabsTrigger value="bildirimler" className="text-slate-600 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm dark:text-slate-300 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-blue-400">
            <Bell className="mr-2 h-4 w-4" />
            Bildirimler
          </TabsTrigger>
          <TabsTrigger value="gorevler" className="text-slate-600 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm dark:text-slate-300 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-blue-400">
            <ListTodo className="mr-2 h-4 w-4" />
            Görevler
          </TabsTrigger>
          <TabsTrigger value="guvenlik" className="text-slate-600 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm dark:text-slate-300 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-blue-400">
            <Shield className="mr-2 h-4 w-4" />
            Güvenlik
          </TabsTrigger>
          <TabsTrigger value="entegrasyonlar" className="text-slate-600 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm dark:text-slate-300 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-blue-400">
            <Key className="mr-2 h-4 w-4" />
            Entegrasyonlar
          </TabsTrigger>
          <TabsTrigger value="gelismis" className="text-slate-600 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm dark:text-slate-300 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-blue-400">
            <Zap className="mr-2 h-4 w-4" />
            Gelişmiş
          </TabsTrigger>
        </TabsList>

        <TabsContent value="genel" className="mt-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <GenelAyarlarPanel searchQuery={searchQuery} resetSection={resetSection} canResetSettings={isAdmin} />
          </div>
        </TabsContent>
        <TabsContent value="gorunum" className="mt-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <GorusAyarlarPanel searchQuery={searchQuery} resetSection={resetSection} canResetSettings={isAdmin} />
          </div>
        </TabsContent>
        <TabsContent value="bildirimler" className="mt-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <BildirimAyarlarPanel searchQuery={searchQuery} resetSection={resetSection} canResetSettings={isAdmin} />
          </div>
        </TabsContent>
        <TabsContent value="gorevler" className="mt-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <GorevlerAyarlarPanel searchQuery={searchQuery} resetSection={resetSection} canResetSettings={isAdmin} />
          </div>
        </TabsContent>
        <TabsContent value="guvenlik" className="mt-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <GuvenlikAyarlarPanel searchQuery={searchQuery} />
          </div>
        </TabsContent>
        <TabsContent value="entegrasyonlar" className="mt-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <EntegrasyonlarAyarlarPanel searchQuery={searchQuery} />
          </div>
        </TabsContent>
        <TabsContent value="gelismis" className="mt-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <GelismisAyarlarPanel
              searchQuery={searchQuery}
              resetSection={resetSection}
              resetToDefaults={resetToDefaults}
              canResetSettings={isAdmin}
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6 dark:border-slate-700">
        <Button
          onClick={save}
          disabled={!isDirty || !canEditSettings}
          variant="outline"
          size="sm"
          className={cn(isDirty && canEditSettings && "border-blue-300 text-blue-700 dark:border-blue-600 dark:text-blue-300")}
        >
          <Settings2 className="mr-2 h-4 w-4" />
          Şimdi kaydet
        </Button>
        {isAdmin && canEditSettings && (
          <Button variant="outline" onClick={resetToDefaults} className="text-slate-700 dark:text-slate-300">
            <RotateCcw className="mr-2 h-4 w-4" />
            Tüm ayarları varsayılana sıfırla
          </Button>
        )}
        {isDirty && (
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Kaydedilmemiş değişiklikler var (otomatik kayıt ~1 sn).
          </span>
        )}
      </div>
    </div>
  );
}
