const FIELD_COLORS: Record<string, string> = {
  "사업화": "bg-violet-50 text-violet-700 ring-violet-200",
  "R&D": "bg-sky-50 text-sky-700 ring-sky-200",
  "시설·공간": "bg-amber-50 text-amber-700 ring-amber-200",
  "멘토링·컨설팅": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "인력": "bg-rose-50 text-rose-700 ring-rose-200",
  "융자": "bg-cyan-50 text-cyan-700 ring-cyan-200",
  "행사·네트워크": "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200",
  "판로·해외진출": "bg-lime-50 text-lime-700 ring-lime-200",
  "글로벌": "bg-teal-50 text-teal-700 ring-teal-200",
};
const FIELD_DEFAULT = "bg-slate-50 text-slate-600 ring-slate-200";

export function FieldBadge({ field, size = "sm" }: { field?: string; size?: "sm" | "md" }) {
  if (!field) return null;
  const key = Object.keys(FIELD_COLORS).find((k) => field.includes(k));
  const color = key ? FIELD_COLORS[key] : FIELD_DEFAULT;
  const sz = size === "md" ? "text-xs px-2.5 py-0.5" : "text-[10px] px-2 py-0.5";
  return (
    <span className={`${sz} rounded-full font-medium ring-1 ring-inset ${color}`}>
      {field}
    </span>
  );
}
