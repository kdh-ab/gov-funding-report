const BAR_COUNT = 5;

const HEIGHTS_SM = ["h-[6px]", "h-[9px]", "h-[12px]", "h-[15px]", "h-[18px]"];
const HEIGHTS_LG = ["h-[8px]", "h-[12px]", "h-[16px]", "h-[20px]", "h-[24px]"];

function getColor(level: number) {
  if (level >= 4) return "bg-blue-500";
  if (level >= 3) return "bg-blue-400";
  if (level >= 2) return "bg-slate-400";
  return "bg-slate-300";
}

export function SignalBar({ level, size = "sm" }: { level: number; size?: "sm" | "lg" }) {
  const clampedLevel = Math.max(1, Math.min(5, level));
  const color = getColor(clampedLevel);
  const gap = size === "lg" ? "gap-[3px]" : "gap-[2px]";
  const barWidth = size === "lg" ? "w-[5px]" : "w-[4px]";
  const heights = size === "lg" ? HEIGHTS_LG : HEIGHTS_SM;

  return (
    <div className={`flex items-end ${gap}`} title={`적합도 ${clampedLevel}/5`}>
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <div
          key={i}
          className={`${barWidth} ${heights[i]} rounded-sm ${i < clampedLevel ? color : "bg-slate-200"}`}
        />
      ))}
    </div>
  );
}
