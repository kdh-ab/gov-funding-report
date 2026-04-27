import type { ReactNode } from "react";

export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        {title}
      </h3>
      <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">{children}</div>
    </div>
  );
}
