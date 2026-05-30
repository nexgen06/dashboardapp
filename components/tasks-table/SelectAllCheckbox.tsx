"use client";

import { useEffect, useRef } from "react";

export function SelectAllCheckbox({
  checked,
  indeterminate,
  onChange,
  className,
  "data-active": dataActive,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className: string;
  "data-active"?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className={className}
      data-active={dataActive}
      aria-label="Tümünü seç"
    />
  );
}
