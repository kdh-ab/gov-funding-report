export function DdayBadge({ dday, size = "sm" }: { dday: number | null; size?: "sm" | "md" }) {
  if (dday === null) return null;
  const label = dday === 0 ? "D-Day" : dday > 0 ? `D-${dday}` : "마감";
  const sz = size === "md" ? "text-xs px-2.5 py-0.5" : "text-[10px] px-2 py-0.5";

  if (dday <= 3) {
    return (
      <span className={`${sz} rounded-full font-bold inline-flex items-center gap-1 bg-red-500 text-white shadow-sm shadow-red-200`}>
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
        </span>
        {label}
      </span>
    );
  }
  if (dday <= 7) {
    return (
      <span className={`${sz} rounded-full font-bold bg-orange-100 text-orange-700 ring-1 ring-inset ring-orange-300`}>
        {label}
      </span>
    );
  }
  if (dday <= 30) {
    return (
      <span className={`${sz} rounded-full font-semibold bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200`}>
        {label}
      </span>
    );
  }
  return (
    <span className={`${sz} rounded-full font-medium text-slate-400`}>
      {label}
    </span>
  );
}
