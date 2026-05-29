"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Key, Plus, Trash2 } from "lucide-react";
import { SettingRow } from "@/components/settings/SettingRow";
import { matchesSearch } from "@/components/settings/settingsSearch";

export function EntegrasyonlarAyarlarPanel({ searchQuery }: { searchQuery: string }) {

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
      <p className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        <strong className="font-semibold">Önizleme:</strong> API anahtarları ve webhook yönetimi örnek veridir; gerçek entegrasyon için backend veya Edge Function gerekir.
      </p>
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
