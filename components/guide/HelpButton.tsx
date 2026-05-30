"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { guideForPath } from "@/lib/guide/content";

/**
 * Header'da yer alan sayfa-bazlı yardım butonu.
 *
 * Tıklayınca o sayfa için en uygun rehber sayfasına yönlendirir
 * (lib/guide/content.ts → PAGE_TO_GUIDE eşlemesi).
 *
 * Aslında klavye kısayolu da var: `?` global HUD'u açar.
 * Bu buton daha keşfedilebilir bir alternatif sunar.
 */
export function HelpButton() {
  const pathname = usePathname() ?? "/";
  // Rehber sayfasında kendisini gizle
  if (pathname.startsWith("/rehber")) return null;
  const guideId = guideForPath(pathname);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={`/rehber?p=${guideId}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Bu sayfa için yardım"
          >
            <HelpCircle className="h-4 w-4" aria-hidden />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="flex flex-col">
            <span className="font-semibold">Bu sayfa için yardım</span>
            <span className="text-[11px] opacity-80">veya `?` ile tüm kısayollar</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
