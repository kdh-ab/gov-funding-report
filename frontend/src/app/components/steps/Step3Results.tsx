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
import { ResultsSummary } from "../results/ResultsSummary";
import { ResultsFilterBar } from "../results/ResultsFilterBar";
import { MatchCardList, MatchCardCompact } from "../results/MatchCard";
import { AnnouncementDetailModal } from "../results/AnnouncementDetailModal";
import { RefreshBanner } from "../results/RefreshBanner";

export function Step3Results({
  result,
  formData,
  onEditCondition,
  onRefreshComplete,
}: {
  result: RecommendResult;
  formData: CompanyFormData;
  onEditCondition: () => void;
  onRefreshComplete: (res: RecommendResponse) => void;
}) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [refreshPending, setRefreshPending] = useState(false);
  const [progressMessages, setProgressMessages] = useState<{ step: string; message: string }[]>([]);
  const [detailMatch, setDetailMatch] = useState<MatchedAnnouncement | null>(null);

  const filters = useResultsFilters(result.matches);

  const crawledDate = result.crawled_at
    ? new Date(result.crawled_at).toLocaleDateString("ko-KR")
    : "";

  const cacheAgeText = (() => {
    const ts = result.crawled_at;
    if (!ts) return null;
    const diffMs = Date.now() - new Date(ts).getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}일 전 데이터`;
    if (hours > 0) return `${hours}시간 전 데이터`;
    return "방금 업데이트됨";
  })();

  const isStale = (() => {
    if (!result.crawled_at) return true;
    const diffMs = Date.now() - new Date(result.crawled_at).getTime();
    return diffMs > 7 * 24 * 60 * 60 * 1000;
  })();

  async function handleRefresh() {
    setRefreshPending(true);
    setProgressMessages([]);

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
              onRefreshComplete({ success: false, error: data.error });
            } else {
              onRefreshComplete({ success: true, ...data });
            }
          } else if (event.type === "error") {
            onRefreshComplete({ success: false, error: event.message });
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      onRefreshComplete({ success: false, error: `최신화 실패: ${message}` });
    } finally {
      setRefreshPending(false);
    }
  }

  async function handleDownload(format: "xlsx" | "pdf") {
    setDownloading(format);
    const res: DownloadResult = await generateReport(result.company.company_name, format);
    setDownloading(null);

    if (!res.success) {
      alert(res.error);
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
  }

  return (
    <div className="space-y-4">
      <ResultsSummary
        result={result}
        crawledDate={crawledDate}
        cacheAgeText={cacheAgeText}
        downloading={downloading}
        refreshPending={refreshPending}
        onDownload={handleDownload}
        onRefresh={handleRefresh}
        onEditCondition={onEditCondition}
      />

      {isStale && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-amber-500 text-lg">⚠</span>
            <p className="text-sm text-amber-800">
              공고 데이터가{crawledDate
                ? <> <span className="font-semibold">{crawledDate}</span> 기준으로, {cacheAgeText}입니다.</>
                : " 최신화된 적이 없습니다."
              } 마감되었거나 새로 등록된 공고가 반영되지 않았을 수 있습니다.
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
        {filters.filtered.map((m) =>
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

      {detailMatch && (
        <AnnouncementDetailModal match={detailMatch} company={formData} onClose={() => setDetailMatch(null)} />
      )}

      {refreshPending && <RefreshBanner progressMessages={progressMessages} />}
    </div>
  );
}
