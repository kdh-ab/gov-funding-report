import type { ReactNode } from "react";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="bg-white rounded-xl border border-[#e8e8e4] p-6 space-y-4 shadow-sm">
      <legend className="text-base font-semibold text-[#131A1C] px-1">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}
