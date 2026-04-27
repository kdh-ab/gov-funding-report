import type { RecommendResult } from "../../actions/recommend";

export function ResultsSummary({
  result,
  crawledDate,
  cacheAgeText,
  downloading,
  refreshPending,
  onDownload,
  onRefresh,
  onEditCondition,
}: {
  result: RecommendResult;
  crawledDate: string;
  cacheAgeText: string | null;
  downloading: string | null;
  refreshPending: boolean;
  onDownload: (format: "xlsx" | "pdf") => void;
  onRefresh: () => void;
  onEditCondition: () => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {result.company.company_name} 맞춤 추천 결과
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            전체 {result.total_announcements}건 중{" "}
            <span className="font-semibold text-blue-600">{result.recommended_count}건</span> 추천
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {crawledDate && (
            <span className="text-xs text-slate-400">
              {crawledDate} 기준 데이터{cacheAgeText ? ` (${cacheAgeText})` : ""}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={() => onDownload("xlsx")}
          disabled={downloading !== null}
          className="px-4 py-2 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {downloading === "xlsx" ? "생성 중..." : "Excel 다운로드"}
        </button>
        <button
          type="button"
          onClick={() => onDownload("pdf")}
          disabled={downloading !== null}
          className="px-4 py-2 text-xs font-medium bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {downloading === "pdf" ? "생성 중..." : "PDF 다운로드"}
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshPending || downloading !== null}
          className="px-4 py-2 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
        >
          {refreshPending ? "크롤링 중..." : "최신 데이터로 추천받기"}
        </button>
        <button
          type="button"
          onClick={onEditCondition}
          className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors ml-auto"
        >
          조건 수정하기
        </button>
      </div>
    </div>
  );
}
