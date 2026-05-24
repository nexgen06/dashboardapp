"use client";

import { useMemo } from "react";
import { useProfileLookup } from "@/contexts/profile-lookup-context";
import { MENTION_REGEX } from "@/lib/mentions";
import { cn } from "@/lib/utils";

/**
 * Yorum metnindeki @mention pattern'lerini chip görünümünde render eder.
 * Bilinmeyen mention'lar (profil eşleşmesi yoksa) düz metin olarak gösterilir.
 */
export function MentionRenderer({ text, className }: { text: string; className?: string }) {
  const profileLookup = useProfileLookup();

  const parts = useMemo(() => {
    if (!text) return [];
    const out: Array<{ kind: "text" | "mention"; value: string; resolvedName?: string; resolvedEmail?: string }> = [];
    let lastIndex = 0;
    // Yeni regex instance her render'da — global flag stateful
    const regex = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (start > lastIndex) {
        out.push({ kind: "text", value: text.slice(lastIndex, start) });
      }
      const prefix = (match[1] ?? "").toLowerCase();
      const all = profileLookup.listAll();
      // Aynı resolve mantığı: tam email → email local → nickname → fullName
      const resolved =
        all.find((p) => (p.email ?? "").toLowerCase() === prefix) ??
        all.find((p) => ((p.email ?? "").split("@")[0] ?? "").toLowerCase() === prefix) ??
        all.find((p) => (p.nickname ?? "").toLowerCase() === prefix) ??
        all.find((p) => ((p.full_name ?? "").split(/\s+/)[0] ?? "").toLowerCase() === prefix);
      if (resolved) {
        const localPart = (resolved.email ?? "").split("@")[0] ?? "";
        const display = resolved.nickname || resolved.full_name?.split(/\s+/)[0] || localPart || resolved.email;
        out.push({
          kind: "mention",
          value: match[0],
          resolvedName: display,
          resolvedEmail: resolved.email ?? undefined,
        });
      } else {
        // Tanınmayan mention — düz metin
        out.push({ kind: "text", value: match[0] });
      }
      lastIndex = end;
    }
    if (lastIndex < text.length) {
      out.push({ kind: "text", value: text.slice(lastIndex) });
    }
    return out;
  }, [text, profileLookup]);

  return (
    <span className={cn("whitespace-pre-wrap break-words", className)}>
      {parts.map((p, i) =>
        p.kind === "mention" ? (
          <span
            key={i}
            className="inline-flex items-center rounded bg-blue-50 px-1 py-0 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-800/60"
            title={p.resolvedEmail ?? p.value}
          >
            @{p.resolvedName}
          </span>
        ) : (
          <span key={i}>{p.value}</span>
        )
      )}
    </span>
  );
}
