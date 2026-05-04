import type { MatchedAnnouncement } from "../../actions/recommend";
import { getDday, getLevelLabel, getLevelColor } from "../../utils/announcement";
import { SourceLogo } from "../ui/SourceLogo";
import { FieldBadge } from "../ui/FieldBadge";
import { DdayBadge } from "../ui/DdayBadge";
import { SignalBar } from "../ui/SignalBar";

function MatchLevel({ match }: { match: MatchedAnnouncement }) {
  const level = match.level ?? (Math.ceil(match.score / 20) || 1);
  return (
    <div className="flex items-center gap-1.5">
      <SignalBar level={level} />
      <span className={`text-[10px] font-medium ${getLevelColor(match.level ?? 0)}`}>
        {getLevelLabel(match.level ?? 0)}
      </span>
    </div>
  );
}

export function MatchCardCompact({
  match,
  onOpenDetail,
}: {
  match: MatchedAnnouncement;
  onOpenDetail: (m: MatchedAnnouncement) => void;
}) {
  const a = match.announcement;
  const dday = getDday(a.receptionPeriod);
  const isKStartup = a.source === "K-Startup";

  return (
    <button
      type="button"
      className={`relative w-full bg-white rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden border flex flex-col text-left ${
        isKStartup
          ? "border-indigo-100 hover:border-indigo-200"
          : "border-teal-100 hover:border-teal-200"
      }`}
      onClick={() => onOpenDetail(match)}
    >
      <div className={`h-1 w-full ${isKStartup ? "bg-indigo-500" : "bg-teal-500"}`} />
      <div className="p-3 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1 flex-wrap min-w-0">
            <SourceLogo source={a.source} />
            <DdayBadge dday={dday} size="sm" />
          </div>
          <MatchLevel match={match} />
        </div>
        <h3 className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2 flex-1">
          {a.title}
        </h3>
        <div className="mt-2 space-y-0.5 text-[10px] text-slate-400">
          {a.receptionPeriod && <p className="truncate">접수: {a.receptionPeriod}</p>}
          {a.supervisionOrg && <p className="truncate">주관: {a.supervisionOrg}</p>}
          {a.region && <p className="truncate">지역: {a.region}</p>}
        </div>
      </div>
    </button>
  );
}

export function MatchCardList({
  match,
  onOpenDetail,
}: {
  match: MatchedAnnouncement;
  onOpenDetail: (m: MatchedAnnouncement) => void;
}) {
  const a = match.announcement;
  const dday = getDday(a.receptionPeriod);
  const isKStartup = a.source === "K-Startup";

  return (
    <button
      type="button"
      className={`relative w-full bg-white rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden border text-left ${
        isKStartup
          ? "border-indigo-100 hover:border-indigo-200"
          : "border-teal-100 hover:border-teal-200"
      }`}
      onClick={() => onOpenDetail(match)}
    >
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${
          isKStartup ? "bg-indigo-500" : "bg-teal-500"
        }`}
      />
      <div className="pl-4 pr-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <SourceLogo source={a.source} />
              <FieldBadge field={a.supportField} size="sm" />
              <DdayBadge dday={dday} size="sm" />
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
            <MatchLevel match={match} />
          </div>
        </div>
      </div>
    </button>
  );
}
