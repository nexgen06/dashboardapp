"use client";

import Link from "next/link";
import { Shield, UserCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { MyPermissionsView } from "@/components/profile/MyPermissionsView";

export default function ProfilYetkilerPage() {
  const { user, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex max-w-3xl items-center justify-center px-6 py-16 text-slate-500">
        Yükleniyor…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-slate-600 dark:text-slate-300">
        Giriş yapmanız gerekir.{" "}
        <Link href="/giris" className="text-blue-600 underline dark:text-blue-400">
          Giriş sayfası
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumb
        items={[
          { label: "Profilim", href: "/profil" },
          { label: "Rolüm ve yetkilerim" },
        ]}
      />

      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-slate-500 dark:text-slate-400" aria-hidden />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Rolüm ve yetkilerim
            </h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Global rolünüz ve bu oturumda geçerli izinlerin özeti.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href="/profil">
            <UserCircle2 className="h-4 w-4" aria-hidden />
            Profilimi düzenle
          </Link>
        </Button>
      </header>

      <MyPermissionsView />
    </div>
  );
}
