import type { ReactNode } from "react";

export function DetailRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
}) {
  if (!value && !children) return null;
  return (
    <div className="flex gap-3 text-sm">
      <span className="shrink-0 w-20 text-slate-500 font-medium">{label}</span>
      <span className="text-slate-800 flex-1">{children || value}</span>
    </div>
  );
}
