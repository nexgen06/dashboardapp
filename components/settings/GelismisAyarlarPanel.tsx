"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useSettings } from "@/contexts/settings-context";
import type { LogLevel } from "@/contexts/settings-context";
import { AlertTriangle, Check, Database, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { SettingRow } from "@/components/settings/SettingRow";
import { matchesSearch } from "@/components/settings/settingsSearch";
import type { GelismisAyarlarPanelProps } from "@/components/settings/settingsPanelTypes";

export function GelismisAyarlarPanel({ searchQuery, resetSection, resetToDefaults, canResetSettings }: GelismisAyarlarPanelProps) {
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

      {/* Tarayıcı verilerini sıfırla — herkes (sadece kendi tarayıcı tercihleri) */}
      {matchesSearch(searchQuery, "Tarayıcı tercihlerini sıfırla", "Kolon ayarları, filtreler, sayfa boyutu vs.") && (
      <SettingRow
        label="Tarayıcı tercihlerini sıfırla"
        description="Bu cihazdaki UI tercihlerini (kolon sıralaması, filtreler, sayfa boyutu, özet panel açık/kapalı, rapor şablonları) varsayılana döndürür. Sunucu verilerine (görev, proje, bildirim) dokunmaz."
      >
        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-700 dark:bg-blue-900/15">
          <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
            Tipik kullanım: özellikleri sıfırdan test etmek istediğinizde, eski tercih önbelleğini temizler. Oturumunuz korunur.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (typeof window === "undefined") return;
              if (!window.confirm("Tarayıcı UI tercihleri silinsin mi? Sayfa yenilenecek.")) return;
              // Auth dışındaki dashboardapp.* + liveTable/reportTemplates anahtarlarını sil
              const keysToDelete: string[] = [];
              for (let i = 0; i < localStorage.length; i += 1) {
                const k = localStorage.key(i);
                if (!k) continue;
                if (
                  k.startsWith("dashboardapp.") ||
                  k.startsWith("dashboardapp:") ||
                  k.includes("liveTable") ||
                  k.includes("reportTemplates") ||
                  k.startsWith("dashboard-settings")
                ) {
                  keysToDelete.push(k);
                }
              }
              keysToDelete.forEach((k) => localStorage.removeItem(k));
              // sessionStorage de temizle (geçici state için)
              try { sessionStorage.clear(); } catch { /* ignore */ }
              window.location.reload();
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Tarayıcı tercihlerini temizle
          </Button>
        </div>
      </SettingRow>
      )}

      {/* Veritabanı Sıfırlama — sadece admin */}
      {canResetSettings && resetMatch && (
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
      {canResetSettings && (
      <div className="pt-4">
        <Button type="button" variant="outline" size="sm" onClick={() => resetSection("gelismis")} className="text-slate-600 dark:text-slate-400">
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
          Bu bölümü varsayılana sıfırla
        </Button>
      </div>
      )}

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
