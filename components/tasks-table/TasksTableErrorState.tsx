"use client";

import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TasksTableErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-lg border-2 border-red-300 bg-red-50 p-5 text-sm text-red-800 dark:border-red-600 dark:bg-red-950/50 dark:text-red-200">
      <p className="font-medium">{error}</p>
      <p className="mt-2 text-xs text-red-600 dark:text-red-300">
        Supabase bağlantısını ve{" "}
        <code className="rounded bg-red-100 px-1 dark:bg-red-900/50">tasks</code> tablosunu kontrol edin.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="mt-4 border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-900/50"
      >
        <RotateCw className="mr-2 h-4 w-4" />
        Yeniden dene
      </Button>
    </div>
  );
}
