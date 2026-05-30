"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info, X, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { slideInRightVariants } from "@/components/motion/motionPresets";

/**
 * Hafif toast + undo sistemi.
 *
 * Kullanım:
 *   const toast = useToast();
 *   toast.success("3 görev silindi", { action: { label: "Geri al", onClick: () => restore() } });
 *
 * Tasarım:
 *  - Sağ-altta yığılmış kartlar
 *  - Varsayılan 4sn; action varsa 6sn
 *  - Aria-live="polite" duyuru
 *  - Action onClick çağrıldıktan sonra toast otomatik kapanır
 */

type ToastKind = "success" | "error" | "info" | "warning";

type ToastAction = {
  label: string;
  onClick: () => void;
};

type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
  description?: string;
  action?: ToastAction;
  durationMs: number;
  createdAt: number;
};

type ToastInput = Omit<Partial<Toast>, "id" | "createdAt" | "kind"> & {
  message: string;
};

type ToastApi = {
  success: (message: string, opts?: Omit<ToastInput, "message">) => string;
  error: (message: string, opts?: Omit<ToastInput, "message">) => string;
  info: (message: string, opts?: Omit<ToastInput, "message">) => string;
  warning: (message: string, opts?: Omit<ToastInput, "message">) => string;
  dismiss: (id: string) => void;
};

type ToastContextValue = {
  toast: ToastApi;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 4000;
const DEFAULT_DURATION_WITH_ACTION_MS = 6000;

let toastCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (kind: ToastKind, input: ToastInput): string => {
      const id = `toast-${++toastCounter}-${Date.now()}`;
      const duration = input.durationMs ?? (input.action ? DEFAULT_DURATION_WITH_ACTION_MS : DEFAULT_DURATION_MS);
      const t: Toast = {
        id,
        kind,
        message: input.message,
        description: input.description,
        action: input.action,
        durationMs: duration,
        createdAt: Date.now(),
      };
      setToasts((prev) => [...prev, t]);
      const handle = setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, handle);
      return id;
    },
    [dismiss]
  );

  const toast = useMemo<ToastApi>(
    () => ({
      success: (message, opts) => push("success", { ...(opts ?? {}), message }),
      error: (message, opts) => push("error", { ...(opts ?? {}), message }),
      info: (message, opts) => push("info", { ...(opts ?? {}), message }),
      warning: (message, opts) => push("warning", { ...(opts ?? {}), message }),
      dismiss,
    }),
    [push, dismiss]
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast yalnızca ToastProvider içinde kullanılabilir");
  }
  return ctx.toast;
}

function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[9999] flex flex-col items-end gap-2 p-4 sm:right-0 sm:left-auto sm:max-w-md"
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}

const KIND_STYLES: Record<ToastKind, { bar: string; icon: React.ReactNode; ring: string }> = {
  success: {
    bar: "bg-emerald-500",
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />,
    ring: "ring-emerald-200 dark:ring-emerald-800",
  },
  error: {
    bar: "bg-red-500",
    icon: <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden />,
    ring: "ring-red-200 dark:ring-red-800",
  },
  info: {
    bar: "bg-blue-500",
    icon: <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden />,
    ring: "ring-blue-200 dark:ring-blue-800",
  },
  warning: {
    bar: "bg-amber-500",
    icon: <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />,
    ring: "ring-amber-200 dark:ring-amber-800",
  },
};

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const style = KIND_STYLES[toast.kind];
  const reduced = useReducedMotion();
  return (
    <motion.div
      role={toast.kind === "error" ? "alert" : "status"}
      layout
      variants={reduced ? undefined : slideInRightVariants}
      initial={reduced ? false : "hidden"}
      animate={reduced ? undefined : "visible"}
      exit={reduced ? undefined : "exit"}
      className={cn(
        "pointer-events-auto flex w-full min-w-[280px] max-w-md items-start gap-3 overflow-hidden rounded-lg border-2 border-slate-200 bg-white pl-0 pr-3 py-3 shadow-2xl ring-1 dark:border-slate-700 dark:bg-slate-800",
        style.ring
      )}
    >
      <div className={cn("w-1 self-stretch shrink-0", style.bar)} aria-hidden />
      <div className="mt-0.5 shrink-0">{style.icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-ui-body font-medium text-slate-900 dark:text-slate-100">{toast.message}</p>
        {toast.description && (
          <p className="mt-0.5 text-ui-caption text-slate-600 dark:text-slate-300">{toast.description}</p>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
            className="mt-2 inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-ui-caption font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden />
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        aria-label="Bildirimi kapat"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </motion.div>
  );
}
