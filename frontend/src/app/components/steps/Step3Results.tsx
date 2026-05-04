"use client";

import { useState } from "react";
import type {
  RecommendResult,
  RecommendResponse,
  CompanyFormData,
  MatchedAnnouncement,
} from "../../actions/recommend";
import { generateReport, type DownloadResult } from "../../actions/download";
import { useResultsFilters } from "../../hooks/useResultsFilters";
import { DashboardPanel } from "../results/DashboardPanel";
import { ResultsFilterBar } from "../results/ResultsFilterBar";
import { MatchCardList, MatchCardCompact } from "../results/MatchCard";
import { AnnouncementDetailModal } from "../results/AnnouncementDetailModal";
import { RefreshBanner } from "../results/RefreshBanner";

export function Step3Results({
  result,
  formData,
  activeView,
  onEditCondition,
  onRefreshComplete,
  onViewChange,
}: {
  result: RecommendResult;
  formData: CompanyFormData;
  activeView: "dashboard" | "announcements";
  onEditCondition: () => void;
  onRefreshComplete: (res: RecommendResponse) => void;
  onViewChange?: (view: "dashboard" | "announcements") => void;
}) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [refreshPending, setRefreshPending] = useState(false);
  const [progressMessages, setProgressMessages] = useState<{ step: string; message: string }[]>([]);
  const [detailMatch, setDetailMatch] = useState<MatchedAnnouncement | null>(null);
  const [selectedDeadlineDate, setSelectedDeadlineDate] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [referenceNow] = useState(() => Date.now());

  const filters = useResultsFilters(result.matches, selectedDeadlineDate);

  const crawledDate = result.crawled_at
    ? new Date(result.crawled_at).toLocaleDateString("ko-KR")
    : "";

  const cacheAgeText = (() => {
    const ts = result.crawled_at;
    if (!ts) return null;
    const diffMs = referenceNow - new Date(ts).getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}일 전 데이터`;
    if (hours > 0) return `${hours}시간 전 데이터`;
    return "방금 업데이트됨";
  })();

  const isStale = (() => {
    if (!result.crawled_at) return true;
    const diffMs = referenceNow - new Date(result.crawled_at).getTime();
    return diffMs > 7 * 24 * 60 * 60 * 1000;
  })();

  async function handleRefresh() {
    setRefreshPending(true);
    setProgressMessages([]);
    setStatusMessage(null);

    try {
      const resp = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData, refresh: true }),
      });

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("스트림을 읽을 수 없습니다");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const dataMatch = line.match(/^data: (.+)/);
          if (!dataMatch) continue;

          const event = JSON.parse(dataMatch[1]);
          if (event.type === "progress") {
            setProgressMessages((prev) => [...prev, { step: event.step, message: event.message }]);
          } else if (event.type === "result") {
            const data = event.data;
            if (data.error) {
              setStatusMessage(data.error);
              onRefreshComplete({ success: false, error: data.error });
            } else {
              setStatusMessage("최신 공고 데이터로 결과를 갱신했습니다.");
              onRefreshComplete({ success: true, ...data });
            }
          } else if (event.type === "error") {
            setStatusMessage(event.message);
            onRefreshComplete({ success: false, error: event.message });
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      setStatusMessage(`최신화 실패: ${message}`);
      onRefreshComplete({ success: false, error: `최신화 실패: ${message}` });
    } finally {
      setRefreshPending(false);
    }
  }

  async function handleDownload(format: "xlsx" | "pdf") {
    setDownloading(format);
    setStatusMessage(null);
    const res: DownloadResult = await generateReport(result.company.company_name, format);
    setDownloading(null);

    if (!res.success) {
      setStatusMessage(res.error);
      return;
    }

    const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: res.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = res.filename;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage(`${format.toUpperCase()} 보고서를 다운로드했습니다.`);
  }

  return (
    <div className="px-7 py-6 space-y-5">
      {statusMessage && (
        <div
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm"
          role="status"
          aria-live="polite"
        >
          {statusMessage}
        </div>
      )}

      {/* 페이지 헤더 — 항상 표시 */}
      <PageHeader
        activeView={activeView}
        crawledDate={crawledDate}
        cacheAgeText={cacheAgeText}
        downloading={downloading}
        refreshPending={refreshPending}
        onDownload={handleDownload}
        onRefresh={handleRefresh}
        onEditCondition={onEditCondition}
      />

      {/* 대시보드 뷰 */}
      {activeView === "dashboard" && (
        <DashboardPanel
          result={result}
          cacheAgeText={cacheAgeText}
          isStale={isStale}
          onOpenDetail={setDetailMatch}
          onDateSelect={(date) => {
            setSelectedDeadlineDate(date);
            onViewChange?.("announcements");
          }}
        />
      )}

      {/* 공고 리스트 뷰 */}
      {activeView === "announcements" && (
        <div className="space-y-4">
          {isStale && (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="text-amber-500 text-lg">⚠</span>
                <p className="text-sm text-amber-800">
                  공고 데이터가{crawledDate
                    ? <> <span className="font-semibold">{crawledDate}</span> 기준, {cacheAgeText}입니다.</>
                    : " 최신화된 적이 없습니다."
                  } 마감되거나 새로 등록된 공고가 반영되지 않았을 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshPending || downloading !== null}
                className="shrink-0 px-4 py-1.5 text-xs font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {refreshPending ? "크롤링 중..." : "지금 최신화"}
              </button>
            </div>
          )}

          {selectedDeadlineDate && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-blue-700">
                  📅 {new Date(selectedDeadlineDate).toLocaleDateString("ko-KR")} 마감 공고
                </span>
                <span className="text-xs text-blue-600">
                  {filters.filtered.length}건
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDeadlineDate(null)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
              >
                필터 해제
              </button>
            </div>
          )}

          <ResultsFilterBar
            sortBy={filters.sortBy}
            onSortChange={filters.setSortBy}
            filterField={filters.filterField}
            onFilterFieldChange={filters.setFilterField}
            filterRegion={filters.filterRegion}
            onFilterRegionChange={filters.setFilterRegion}
            filterDeadline={filters.filterDeadline}
            onFilterDeadlineChange={filters.setFilterDeadline}
            filterOrg={filters.filterOrg}
            onFilterOrgChange={filters.setFilterOrg}
            viewMode={filters.viewMode}
            onViewModeChange={filters.setViewMode}
            fields={filters.fields}
            regions={filters.regions}
            orgs={filters.orgs}
            hasActiveFilter={filters.hasActiveFilter}
            onClearFilters={filters.clearFilters}
          />

          <div className={filters.viewMode === "grid" ? "grid grid-cols-2 gap-3" : "space-y-3"}>
            {filters.paginated.map((m) =>
              filters.viewMode === "grid" ? (
                <MatchCardCompact key={m.announcement.pbancSn || m.rank} match={m} onOpenDetail={setDetailMatch} />
              ) : (
                <MatchCardList key={m.announcement.pbancSn || m.rank} match={m} onOpenDetail={setDetailMatch} />
              )
            )}
            {filters.filtered.length === 0 && (
              <p className={`text-center text-sm text-slate-400 py-8 ${filters.viewMode === "grid" ? "col-span-2" : ""}`}>
                조건에 맞는 공고가 없습니다
              </p>
            )}
          </div>

          {filters.totalPages > 1 && (
            <Pagination
              page={filters.page}
              totalPages={filters.totalPages}
              totalCount={filters.filtered.length}
              pageSize={filters.pageSize}
              onPageChange={filters.setPage}
            />
          )}
        </div>
      )}

      {detailMatch && (
        <AnnouncementDetailModal match={detailMatch} company={formData} onClose={() => setDetailMatch(null)} />
      )}

      {refreshPending && <RefreshBanner progressMessages={progressMessages} />}
    </div>
  );
}

// ─── 페이지네이션 ─────────────────────────────────────────────────────────────

function getPageNumbers(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const pages: (number | "…")[] = [1];

  if (page > 3) pages.push("…");

  const start = Math.max(2, page - 1);
  const end   = Math.min(totalPages - 1, page + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (page < totalPages - 2) pages.push("…");
  pages.push(totalPages);

  return pages;
}

function Pagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, totalCount);
  const nums = getPageNumbers(page, totalPages);

  const btnBase =
    "min-w-[32px] h-8 px-2 rounded-lg text-[13px] font-medium transition-colors flex items-center justify-center";

  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-xs text-slate-400">
        {from}–{to} / 전체 {totalCount}건
      </p>

      <div className="flex items-center gap-1">
        {/* 이전 */}
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={`${btnBase} text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          ‹
        </button>

        {/* 페이지 번호 */}
        {nums.map((n, i) =>
          n === "…" ? (
            <span key={`ellipsis-${i}`} className="w-8 text-center text-xs text-slate-400 select-none">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onPageChange(n)}
              className={`${btnBase} ${
                n === page
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {n}
            </button>
          )
        )}

        {/* 다음 */}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className={`${btnBase} text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          ›
        </button>
      </div>
    </div>
  );
}

// ─── 페이지 헤더 ──────────────────────────────────────────────────────────────

function PageHeader({
  activeView,
  crawledDate,
  cacheAgeText,
  downloading,
  refreshPending,
  onDownload,
  onRefresh,
  onEditCondition,
}: {
  activeView: "dashboard" | "announcements";
  crawledDate: string;
  cacheAgeText: string | null;
  downloading: string | null;
  refreshPending: boolean;
  onDownload: (fmt: "xlsx" | "pdf") => void;
  onRefresh: () => void;
  onEditCondition: () => void;
}) {
  const titles = {
    dashboard: "대시보드",
    announcements: "공고 리스트",
  };

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{titles[activeView]}</h1>
        {(crawledDate || cacheAgeText) && (
          <p className="mt-1 text-xs text-slate-500">
            {crawledDate ? `${crawledDate} 기준` : "캐시 기준"} {cacheAgeText ? `· ${cacheAgeText}` : ""}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onEditCondition}
          className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-white transition-colors"
        >
          조건 수정
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshPending || downloading !== null}
          className="px-3 py-1.5 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
        >
          {refreshPending ? "크롤링 중..." : "데이터 최신화"}
        </button>
        <button
          type="button"
          onClick={() => onDownload("xlsx")}
          disabled={downloading !== null}
          className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {downloading === "xlsx" ? "생성 중..." : "Excel"}
        </button>
        <button
          type="button"
          onClick={() => onDownload("pdf")}
          disabled={downloading !== null}
          className="px-3 py-1.5 text-xs font-medium bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {downloading === "pdf" ? "생성 중..." : "PDF"}
        </button>
      </div>
    </div>
  );
}
