"use client";

import Link from "next/link";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

type YonetimAccessDeniedProps = {
  title?: string;
  description?: string;
};

/** Admin/yönetim sayfalarında yetkisiz erişim — profil/yetkiler'e yönlendirme sunar. */
export function YonetimAccessDenied({
  title = "Bu sayfaya erişim yetkiniz yok",
  description = "Bu bölüm yalnızca yönetim yetkisine sahip kullanıcılar içindir. Kendi rolünüzü ve izinlerinizi profil sayfasından görebilirsiniz.",
}: YonetimAccessDeniedProps) {
  return (
    <div className="container max-w-4xl py-8">
      <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-700 dark:bg-amber-950/30">
        <Shield className="mx-auto mb-3 h-12 w-12 text-amber-600 dark:text-amber-400" aria-hidden />
        <p className="font-medium text-slate-800 dark:text-slate-200">{title}</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Button asChild variant="outline">
            <Link href="/profil/yetkiler">Rolüm ve yetkilerim</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">Ana sayfaya dön</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
