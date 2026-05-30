"use client";

import Link from "next/link";
import { Lightbulb, AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GuideSection } from "@/lib/guide/types";

/**
 * Yapılandırılmış rehber section'larını React'e render eder.
 *
 * Markdown yerine type-safe section şeması — IDE autocomplete, derleme
 * zamanı kontrol. İçerik kararlı olunca MDX'e geçirilebilir.
 *
 * Text içinde **bold** desteği (split-and-bold yöntemi). Code/link
 * gerekirse ileride genişletilir.
 */
function renderInlineText(text: string): React.ReactNode {
  // **bold** — split by ** and toggle
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-slate-900 dark:text-slate-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    // `code`
    const codeParts = part.split(/(`[^`]+`)/g);
    return codeParts.map((cp, j) => {
      if (cp.startsWith("`") && cp.endsWith("`")) {
        return (
          <code
            key={`${i}-${j}`}
            className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-800 dark:bg-slate-800 dark:text-slate-200"
          >
            {cp.slice(1, -1)}
          </code>
        );
      }
      return cp;
    });
  });
}

function Section({ section }: { section: GuideSection }) {
  switch (section.type) {
    case "p":
      return (
        <p className="my-3 leading-relaxed text-slate-700 dark:text-slate-300">
          {renderInlineText(section.text)}
        </p>
      );
    case "h2":
      return (
        <h2 className="mt-8 mb-3 border-b border-slate-200 pb-1.5 text-xl font-bold tracking-tight text-slate-900 dark:border-slate-700 dark:text-slate-100">
          {section.text}
        </h2>
      );
    case "h3":
      return (
        <h3 className="mt-5 mb-2 text-base font-semibold text-slate-800 dark:text-slate-200">
          {section.text}
        </h3>
      );
    case "list": {
      const Tag = section.ordered ? "ol" : "ul";
      return (
        <Tag
          className={cn(
            "my-3 ml-5 space-y-1.5 text-slate-700 dark:text-slate-300",
            section.ordered ? "list-decimal" : "list-disc"
          )}
        >
          {section.items.map((it, i) => (
            <li key={i} className="leading-relaxed">{renderInlineText(it)}</li>
          ))}
        </Tag>
      );
    }
    case "tip":
      return (
        <div className="my-4 flex gap-3 rounded-lg border-l-4 border-blue-400 bg-blue-50/60 px-4 py-3 dark:border-blue-500 dark:bg-blue-950/30">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
          <div className="text-sm leading-relaxed text-blue-900 dark:text-blue-200">
            {renderInlineText(section.text)}
          </div>
        </div>
      );
    case "warning":
      return (
        <div className="my-4 flex gap-3 rounded-lg border-l-4 border-amber-400 bg-amber-50/60 px-4 py-3 dark:border-amber-500 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <div className="text-sm leading-relaxed text-amber-900 dark:text-amber-200">
            {renderInlineText(section.text)}
          </div>
        </div>
      );
    case "kbd":
      return (
        <div className="my-1.5 flex items-center gap-3 rounded-md border border-slate-200 bg-white/60 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="flex shrink-0 items-center gap-1">
            {section.keys.map((k, i) => (
              <span key={i} className="flex items-center gap-1">
                <kbd className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-slate-300 bg-white px-1.5 text-[11px] font-semibold text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200">
                  {k}
                </kbd>
                {i < section.keys.length - 1 && (
                  <span className="text-xs text-slate-400">+</span>
                )}
              </span>
            ))}
          </div>
          <span className="text-sm text-slate-700 dark:text-slate-300">{section.description}</span>
        </div>
      );
    case "code":
      return (
        <pre className="my-3 overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
          <code>{section.code}</code>
        </pre>
      );
    case "action":
      return (
        <Link
          href={section.href}
          className="my-3 inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
        >
          {section.label}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      );
    case "divider":
      return <hr className="my-6 border-slate-200 dark:border-slate-700" />;
    case "table":
      return (
        <div className="my-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                {section.headers.map((h, i) => (
                  <th
                    key={i}
                    className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {section.rows.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      {renderInlineText(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return null;
  }
}

export function GuideRenderer({ sections }: { sections: GuideSection[] }) {
  return (
    <article className="max-w-3xl">
      {sections.map((s, i) => (
        <Section key={i} section={s} />
      ))}
    </article>
  );
}
