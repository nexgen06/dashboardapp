"use client";

import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tarayıcı window.confirm / window.alert / window.prompt yerine kullanılan
 * sayfa-içi modern dialog API'leri.
 *
 * Kullanım:
 *   const confirm = useConfirm();
 *   const ok = await confirm({ title: "Sil?", message: "Geri alınamaz." });
 *   if (!ok) return;
 *
 *   const prompt = usePrompt();
 *   const name = await prompt({ title: "Yeni ad", defaultValue: "X" });
 *   if (name == null) return;
 */

type ConfirmOptions = {
  title: React.ReactNode;
  message?: React.ReactNode;
  /** "Onayla" butonu metni. Varsayılan: "Tamam". */
  confirmLabel?: string;
  /** "Vazgeç" butonu metni. Varsayılan: "Vazgeç". */
  cancelLabel?: string;
  /** "destructive" → kırmızı vurgu, dikkat ikonu */
  variant?: "default" | "destructive";
};

type PromptOptions = {
  title: React.ReactNode;
  message?: React.ReactNode;
  defaultValue?: string;
  placeholder?: string;
  /** "Tamam" butonu metni. Varsayılan: "Tamam". */
  confirmLabel?: string;
  /** Boş bırakılırsa onaylanamaz. Varsayılan: true. */
  required?: boolean;
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;
type PromptFn = (opts: PromptOptions) => Promise<string | null>;

const ConfirmContext = createContext<ConfirmFn | null>(null);
const PromptContext = createContext<PromptFn | null>(null);

export function ModalsProvider({ children }: { children: React.ReactNode }) {
  // Confirm state
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { id: number }) | null>(null);
  const confirmResolveRef = useRef<((v: boolean) => void) | null>(null);
  const confirmIdRef = useRef(0);

  const confirm: ConfirmFn = useCallback((opts) => {
    return new Promise<boolean>((resolve) => {
      confirmResolveRef.current = resolve;
      confirmIdRef.current += 1;
      setConfirmState({ ...opts, id: confirmIdRef.current });
    });
  }, []);

  const handleConfirmResult = useCallback((result: boolean) => {
    const r = confirmResolveRef.current;
    confirmResolveRef.current = null;
    setConfirmState(null);
    if (r) r(result);
  }, []);

  // Prompt state
  const [promptState, setPromptState] = useState<(PromptOptions & { id: number }) | null>(null);
  const promptResolveRef = useRef<((v: string | null) => void) | null>(null);
  const promptIdRef = useRef(0);
  const [promptValue, setPromptValue] = useState("");

  const prompt: PromptFn = useCallback((opts) => {
    return new Promise<string | null>((resolve) => {
      promptResolveRef.current = resolve;
      promptIdRef.current += 1;
      setPromptValue(opts.defaultValue ?? "");
      setPromptState({ ...opts, id: promptIdRef.current });
    });
  }, []);

  const handlePromptResult = useCallback(
    (result: string | null) => {
      const r = promptResolveRef.current;
      promptResolveRef.current = null;
      setPromptState(null);
      if (r) r(result);
    },
    []
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      <PromptContext.Provider value={prompt}>
        {children}

        {/* Confirm dialog */}
        <Dialog
          open={!!confirmState}
          onOpenChange={(open) => {
            if (!open && confirmState) handleConfirmResult(false);
          }}
        >
          <DialogContent className="sm:max-w-md" showClose={false}>
            <DialogHeader>
              <DialogTitle
                className={cn(
                  "flex items-center gap-2",
                  confirmState?.variant === "destructive" && "text-red-700 dark:text-red-300"
                )}
              >
                {confirmState?.variant === "destructive" && (
                  <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
                )}
                {confirmState?.title}
              </DialogTitle>
              {confirmState?.message && (
                <DialogDescription className="text-slate-600 dark:text-slate-400">
                  {confirmState.message}
                </DialogDescription>
              )}
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleConfirmResult(false)}
              >
                {confirmState?.cancelLabel ?? "Vazgeç"}
              </Button>
              <Button
                type="button"
                variant={confirmState?.variant === "destructive" ? "destructive" : "default"}
                onClick={() => handleConfirmResult(true)}
                autoFocus
              >
                {confirmState?.confirmLabel ?? "Tamam"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Prompt dialog */}
        <Dialog
          open={!!promptState}
          onOpenChange={(open) => {
            if (!open && promptState) handlePromptResult(null);
          }}
        >
          <DialogContent className="sm:max-w-md" showClose={false}>
            <DialogHeader>
              <DialogTitle>{promptState?.title}</DialogTitle>
              {promptState?.message && (
                <DialogDescription className="text-slate-600 dark:text-slate-400">
                  {promptState.message}
                </DialogDescription>
              )}
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const val = promptValue.trim();
                if (promptState?.required !== false && !val) return;
                handlePromptResult(val);
              }}
              className="py-1"
            >
              <input
                type="text"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                placeholder={promptState?.placeholder ?? ""}
                autoFocus
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handlePromptResult(null)}
                >
                  Vazgeç
                </Button>
                <Button
                  type="submit"
                  disabled={promptState?.required !== false && !promptValue.trim()}
                >
                  {promptState?.confirmLabel ?? "Tamam"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PromptContext.Provider>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm() must be used inside <ModalsProvider>");
  return ctx;
}

export function usePrompt(): PromptFn {
  const ctx = useContext(PromptContext);
  if (!ctx) throw new Error("usePrompt() must be used inside <ModalsProvider>");
  return ctx;
}
