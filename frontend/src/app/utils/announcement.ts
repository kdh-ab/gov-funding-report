export function parsePeriodEnd(period: string): Date | null {
  if (!period) return null;
  const dates = period.match(/(\d{4}-\d{1,2}-\d{1,2})/g);
  if (dates && dates.length >= 2) return new Date(dates[1]);
  if (dates && dates.length === 1) return new Date(dates[0]);
  return null;
}

export function getDday(period: string): number | null {
  const end = parsePeriodEnd(period);
  if (!end) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export function getLevelLabel(level: number): string {
  if (level >= 5) return "매우높음";
  if (level >= 4) return "높음";
  if (level >= 3) return "보통";
  if (level >= 2) return "낮음";
  return "미약";
}

export function getLevelColor(level: number): string {
  if (level >= 4) return "text-blue-500";
  if (level >= 3) return "text-blue-400";
  return "text-slate-400";
}
