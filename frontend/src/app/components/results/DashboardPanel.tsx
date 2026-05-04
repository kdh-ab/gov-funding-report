"use client";

import type { MatchedAnnouncement, RecommendResult } from "../../actions/recommend";
import { getDday, getLevelLabel, getLevelColor, parsePeriodEnd } from "../../utils/announcement";
import { SignalBar } from "../ui/SignalBar";
import { DdayBadge } from "../ui/DdayBadge";
import { FieldBadge } from "../ui/FieldBadge";
import { SourceLogo } from "../ui/SourceLogo";

interface Props {
  result: RecommendResult;
  cacheAgeText: string | null;
  isStale: boolean;
  onOpenDetail: (match: MatchedAnnouncement) => void;
  onDateSelect?: (date: string) => void;
}

export function DashboardPanel({ result, cacheAgeText: _cacheAgeText, isStale: _isStale, onOpenDetail, onDateSelect }: Props) {
  void _cacheAgeText;
  void _isStale;
  const { matches, recommended_count, total_announcements } = result;

  // 마감 임박 그룹 분류
  const withDday = matches
    .map((m) => ({ match: m, dday: getDday(m.announcement.receptionPeriod) }))
    .filter(({ dday }) => dday !== null && dday >= 0 && dday <= 7) as {
    match: MatchedAnnouncement;
    dday: number;
  }[];

  const urgentGroups = {
    today:  withDday.filter(({ dday }) => dday === 0),
    d3:     withDday.filter(({ dday }) => dday >= 1 && dday <= 3),
    d7:     withDday.filter(({ dday }) => dday >= 4 && dday <= 7),
  };

  const top3 = matches.slice(0, 3);

  return (
    <div className="space-y-3">
      {/* KPI 카드 2개 */}
      <div className="grid grid-cols-2 gap-3">
        <StatusCard
          icon="📌"
          label="추천 공고"
          value={recommended_count}
          total={total_announcements}
          unit="건"
        />
        <StatusCard
          icon="⚠️"
          label="마감 임박"
          value={String(withDday.length)}
          unit="건"
        />
      </div>

      {/* 이번 주 마감공고 달력 */}
      <WeeklyDeadlineCalendar matches={matches} onDateSelect={onDateSelect} />

      {/* TOP 3 (전체 너비) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-bold text-slate-900">추천 TOP 3</span>
        </div>

        {top3.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">추천 공고가 없습니다</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {top3.map((match, idx) => (
              <Top3Row
                key={match.announcement.pbancSn || idx}
                match={match}
                rank={idx + 1}
                onOpen={onOpenDetail}
              />
            ))}
          </div>
        )}
      </div>

      {/* 마감 임박 */}
      <UrgentActionItems groups={urgentGroups} maxItems={5} onOpen={onOpenDetail} />

      {/* 분야별 분포 */}
      <FieldDistribution matches={matches} />
    </div>
  );
}

// ─── 마감 임박 Action Items ────────────────────────────────────────────────────

type UrgentGroup = { match: MatchedAnnouncement; dday: number };

const URGENT_TIERS = [
  {
    key: "today" as const,
    label: "오늘 마감",
    dot: "bg-red-500",
    labelCls: "text-red-600",
    countCls: "bg-red-50 text-red-600 ring-1 ring-inset ring-red-200",
  },
  {
    key: "d3" as const,
    label: "D-3 이내",
    dot: "bg-orange-400",
    labelCls: "text-orange-600",
    countCls: "bg-orange-50 text-orange-600 ring-1 ring-inset ring-orange-200",
  },
  {
    key: "d7" as const,
    label: "이번 주 마감",
    dot: "bg-amber-400",
    labelCls: "text-amber-600",
    countCls: "bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-200",
  },
];

function UrgentActionItems({
  groups,
  maxItems = 10,
  onOpen,
}: {
  groups: Record<"today" | "d3" | "d7", UrgentGroup[]>;
  maxItems?: number;
  onOpen: (m: MatchedAnnouncement) => void;
}) {
  const totalUrgent = groups.today.length + groups.d3.length + groups.d7.length;
  const todayCount = Math.min(groups.today.length, maxItems);
  const d3Slots = Math.max(maxItems - todayCount, 0);
  const d3Count = Math.min(groups.d3.length, d3Slots);
  const d7Slots = Math.max(maxItems - todayCount - d3Count, 0);
  const d7Count = Math.min(groups.d7.length, d7Slots);

  const tierSections = [
    { tier: URGENT_TIERS[0], items: groups.today, itemsToShow: groups.today.slice(0, todayCount) },
    { tier: URGENT_TIERS[1], items: groups.d3, itemsToShow: groups.d3.slice(0, d3Count) },
    { tier: URGENT_TIERS[2], items: groups.d7, itemsToShow: groups.d7.slice(0, d7Count) },
  ].filter((section): section is {
    tier: typeof URGENT_TIERS[number];
    items: UrgentGroup[];
    itemsToShow: UrgentGroup[];
  } => section.items.length > 0 && section.itemsToShow.length > 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-bold text-slate-900">마감 임박</span>
        <span className="text-xs text-slate-400 font-normal">지금 확인해야 할 공고</span>
        {totalUrgent > 0 && (
          <span className="ml-auto text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full ring-1 ring-inset ring-red-200">
            {totalUrgent}건
          </span>
        )}
      </div>

      {totalUrgent === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <span className="text-2xl mb-2">✓</span>
          <p className="text-sm font-medium text-slate-600">마감 임박 공고 없음</p>
          <p className="text-xs text-slate-400 mt-1">D-7 이내 마감 공고가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tierSections.map(({ tier, items, itemsToShow }) => (
            <div key={tier.key}>
                {/* 티어 헤더 */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${tier.dot}`} />
                  <span className={`text-[11px] font-semibold ${tier.labelCls}`}>
                    {tier.label}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${tier.countCls}`}>
                    총 {items.length}건
                  </span>
                </div>

                {/* 공고 목록 */}
                <div className="space-y-1 pl-4">
                  {itemsToShow.map(({ match, dday }, idx) => (
                    <UrgentRow
                      key={match.announcement.pbancSn || idx}
                      match={match}
                      dday={dday}
                      onOpen={onOpen}
                    />
                  ))}
                </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UrgentRow({
  match,
  onOpen,
}: {
  match: MatchedAnnouncement;
  onOpen: (m: MatchedAnnouncement) => void;
}) {
  const a = match.announcement;

  return (
    <button
      type="button"
      onClick={() => onOpen(match)}
      className="w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-50 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-slate-700 truncate group-hover:text-blue-700 transition-colors">
          {a.title}
        </p>
        {a.supportField && (
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">{a.supportField}</p>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        <SignalBar level={match.level} size="sm" />
        <span className={`text-[10px] font-medium ${getLevelColor(match.level ?? 0)}`}>
          {getLevelLabel(match.level ?? 0)}
        </span>
      </div>
    </button>
  );
}

// ─── 분야별 분포 ───────────────────────────────────────────────────────────────

const FIELD_COLORS_HEX = [
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#d946ef", // fuchsia
  "#ec4899", // pink
  "#f43f5e", // rose
  "#f97316", // orange
  "#eab308", // yellow
  "#84cc16", // lime
  "#22c55e", // green
  "#10b981", // emerald
];

function FieldDistribution({ matches }: { matches: MatchedAnnouncement[] }) {
  const countMap: Record<string, number> = {};
  for (const m of matches) {
    const field = m.announcement.supportField?.trim() || "기타";
    countMap[field] = (countMap[field] ?? 0) + 1;
  }

  const sorted = Object.entries(countMap).sort((a, b) => b[1] - a[1]);

  if (matches.length === 0 || sorted.length === 0) return null;

  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);
  const totalFields = sorted.length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[11px] font-medium text-slate-500 mb-2">지원분야 분포</p>
          <p className="text-2xl font-bold text-slate-900">{totalFields}</p>
          <p className="text-xs text-slate-400 mt-1">개 분야</p>
        </div>
      </div>

      {/* 세로 막대 차트 — Top 3 */}
      <div className="mb-6 flex items-end justify-center gap-4 h-64">
        {top3.map(([field, count], idx) => {
          const maxCount = Math.max(...top3.map(([, c]) => c));
          const heightPercent = (count / maxCount) * 100;
          const percentage = Math.round((count / matches.length) * 100);

          return (
            <div key={field} className="flex flex-col items-center gap-2 flex-1">
              <div className="flex flex-col items-center gap-1 mb-2">
                <span className="text-sm font-bold text-slate-900">{percentage}%</span>
                <span className="text-xs text-slate-500 text-center line-clamp-2">{field}</span>
              </div>
              <div className="w-full flex items-end justify-center h-40">
                <div
                  className="w-12 rounded-t-lg transition-all duration-500 hover:opacity-80"
                  style={{
                    height: `${heightPercent}%`,
                    backgroundColor: FIELD_COLORS_HEX[idx % FIELD_COLORS_HEX.length],
                  }}
                  title={`${field}: ${count}건`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 나머지 항목 가로 막대 차트 */}
      {rest.length > 0 && (
        <div className="border-t border-slate-200 pt-6">
          <p className="text-xs font-semibold text-slate-600 mb-4">나머지 분야</p>
          <div className="space-y-3">
            {rest.map(([field, count], idx) => {
              const percentage = Math.round((count / matches.length) * 100);
              const colorIdx = 3 + idx;

              return (
                <div key={field}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium text-slate-700 truncate flex-1">{field}</span>
                    <span className="text-xs font-semibold text-slate-600 shrink-0">{count}건 {percentage}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: FIELD_COLORS_HEX[colorIdx % FIELD_COLORS_HEX.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


// ─── 상태 카드 ─────────────────────────────────────────────────────────────────

function StatusCard({
  icon,
  label,
  value,
  unit,
  total,
}: {
  icon: string;
  label: string;
  value: string | number;
  unit: string;
  total?: number;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col items-center text-center">
      <span className="text-2xl mb-2">{icon}</span>
      <p className="text-[11px] font-medium text-slate-500 mb-1.5">{label}</p>
      <p className="leading-none">
        {total !== undefined ? (
          <>
            <span className="text-xl font-bold text-blue-600">{value}</span>
            <span className="text-sm font-normal text-slate-400">/{total}</span>
          </>
        ) : (
          <span className="text-xl font-bold text-slate-900">{value}</span>
        )}
        {unit && (
          <span className="text-sm font-normal text-slate-400 ml-0.5">{unit}</span>
        )}
      </p>
    </div>
  );
}

// ─── 이번 주 마감공고 달력 ──────────────────────────────────────────────────────

function WeeklyDeadlineCalendar({
  matches,
  onDateSelect,
}: {
  matches: MatchedAnnouncement[];
  onDateSelect?: (date: string) => void;
}) {
  const today = new Date();
  const dayOfWeek = today.getDay();
  // 월요일을 0으로 하기 위해 조정
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(monday.getDate() - mondayOffset);
  monday.setHours(0, 0, 0, 0);

  // 각 날짜별 마감공고 수 계산
  const deadlineCount: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];
    deadlineCount[dateStr] = 0;
  }

  for (const match of matches) {
    const endDate = parsePeriodEnd(match.announcement.receptionPeriod);
    if (endDate) {
      const endDateStr = endDate.toISOString().split("T")[0];
      if (endDateStr in deadlineCount) {
        deadlineCount[endDateStr]++;
      }
    }
  }

  const daysOfWeek = ["월", "화", "수", "목", "금", "토", "일"];
  const todayStr = today.toISOString().split("T")[0];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-900 mb-4">이번 주 마감공고</p>
      <div className="grid grid-cols-7 gap-2.5">
        {/* 요일 헤더 */}
        {daysOfWeek.map((day, i) => (
          <div key={`header-${i}`} className="text-center text-[11px] font-semibold text-slate-500 py-2">
            {day}
          </div>
        ))}
        {/* 날짜 셀 */}
        {Array.from({ length: 7 }).map((_, i) => {
          const date = new Date(monday);
          date.setDate(date.getDate() + i);
          const dateStr = date.toISOString().split("T")[0];
          const count = deadlineCount[dateStr] || 0;
          const isToday = dateStr === todayStr;
          const hasDeadline = count > 0;

          return (
            <button
              key={dateStr}
              onClick={() => hasDeadline && onDateSelect?.(dateStr)}
              disabled={!hasDeadline}
              className={`flex flex-col items-center justify-center rounded-lg py-3 transition-all disabled:cursor-default ${
                isToday
                  ? "bg-blue-500 text-white shadow-md"
                  : hasDeadline
                  ? "bg-slate-50 text-slate-700 hover:bg-slate-100 cursor-pointer"
                  : "bg-slate-50 text-slate-400"
              }`}
            >
              <span className="text-sm font-bold">{date.getDate()}</span>
              {count > 0 && (
                <span className={`text-[10px] mt-1 font-semibold ${isToday ? "text-blue-100" : "text-blue-600"}`}>
                  {count}건
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── TOP 3 행 ──────────────────────────────────────────────────────────────────

function Top3Row({
  match,
  rank,
  onOpen,
}: {
  match: MatchedAnnouncement;
  rank: number;
  onOpen: (m: MatchedAnnouncement) => void;
}) {
  const a = match.announcement;
  const dday = getDday(a.receptionPeriod);
  return (
    <button
      type="button"
      onClick={() => onOpen(match)}
      className="w-full text-left relative bg-white rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden border border-slate-100 hover:border-slate-200 mb-3 last:mb-0"
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300" />
      <div className="pl-4 pr-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span className="text-[10px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                #{rank}
              </span>
              <SourceLogo source={a.source} />
              <FieldBadge field={a.supportField} size="sm" />
              {dday !== null && dday >= 0 && <DdayBadge dday={dday} size="sm" />}
            </div>
            <h3 className="text-sm font-semibold text-slate-900 leading-snug">{a.title}</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
              {a.supervisionOrg && <span>주관: {a.supervisionOrg}</span>}
              {a.receptionPeriod && <span>접수: {a.receptionPeriod}</span>}
              {a.region && <span>지역: {a.region}</span>}
            </div>
            {match.match_reasons.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {match.match_reasons.slice(0, 3).map((reason, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                    {reason}
                  </span>
                ))}
                {match.match_reasons.length > 3 && (
                  <span className="text-[10px] text-slate-400">+{match.match_reasons.length - 3}</span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <SignalBar level={match.level} />
              <span className={`text-[10px] font-medium ${getLevelColor(match.level ?? 0)}`}>
                {getLevelLabel(match.level ?? 0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
