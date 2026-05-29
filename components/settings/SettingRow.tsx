"use client";

export function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 py-4 border-b border-slate-100 last:border-0 dark:border-slate-700">
      <label className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</label>
      {description && (
        <p className="text-xs text-slate-500 mb-2 dark:text-slate-400" title="Ne işe yarar / ne zaman kullanılır">
          {description}
        </p>
      )}
      {children}
    </div>
  );
}
