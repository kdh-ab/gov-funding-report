export function ResultsFilterBar({
  sortBy,
  onSortChange,
  filterField,
  onFilterFieldChange,
  filterRegion,
  onFilterRegionChange,
  filterDeadline,
  onFilterDeadlineChange,
  filterOrg,
  onFilterOrgChange,
  viewMode,
  onViewModeChange,
  fields,
  regions,
  orgs,
  hasActiveFilter,
  onClearFilters,
}: {
  sortBy: "score" | "deadline";
  onSortChange: (v: "score" | "deadline") => void;
  filterField: string;
  onFilterFieldChange: (v: string) => void;
  filterRegion: string;
  onFilterRegionChange: (v: string) => void;
  filterDeadline: string;
  onFilterDeadlineChange: (v: string) => void;
  filterOrg: string;
  onFilterOrgChange: (v: string) => void;
  viewMode: "list" | "grid";
  onViewModeChange: (v: "list" | "grid") => void;
  fields: string[];
  regions: string[];
  orgs: string[];
  hasActiveFilter: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <button
        type="button"
        onClick={() => onSortChange(sortBy === "score" ? "deadline" : "score")}
        className="flex items-center gap-2 cursor-pointer"
      >
        <span className={`text-xs font-medium transition-colors ${sortBy === "score" ? "text-slate-900" : "text-slate-400"}`}>
          적합도순
        </span>
        <div className={`relative w-8 h-[18px] rounded-full transition-colors duration-200 ${
          sortBy === "score" ? "bg-blue-500" : "bg-amber-500"
        }`}>
          <div className={`absolute top-[2px] w-[14px] h-[14px] bg-white rounded-full shadow-sm transition-all duration-200 ${
            sortBy === "score" ? "left-[2px]" : "left-[14px]"
          }`} />
        </div>
        <span className={`text-xs font-medium transition-colors ${sortBy === "deadline" ? "text-slate-900" : "text-slate-400"}`}>
          마감임박순
        </span>
      </button>

      {fields.length > 1 && (
        <select
          value={filterField}
          onChange={(e) => onFilterFieldChange(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="">전체 분야</option>
          {fields.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      )}

      {regions.length > 1 && (
        <select
          value={filterRegion}
          onChange={(e) => onFilterRegionChange(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="">전체 지역</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      )}

      <select
        value={filterDeadline}
        onChange={(e) => onFilterDeadlineChange(e.target.value)}
        className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
      >
        <option value="">전체 일정</option>
        <option value="7">7일 이내 마감</option>
        <option value="30">30일 이내 마감</option>
        <option value="over30">30일 이후 마감</option>
        <option value="unknown">마감일 미정</option>
      </select>

      {orgs.length > 1 && (
        <select
          value={filterOrg}
          onChange={(e) => onFilterOrgChange(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="">전체 주관처</option>
          {orgs.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}

      <div className="flex items-center gap-2 ml-auto">
        {hasActiveFilter && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            필터 초기화
          </button>
        )}
        <div className="flex border border-slate-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => onViewModeChange("list")}
            className={`p-1.5 transition-colors ${
              viewMode === "list" ? "bg-slate-800 text-white" : "bg-white text-slate-400 hover:text-slate-600"
            }`}
            title="리스트 보기"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 3h12M2 8h12M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("grid")}
            className={`p-1.5 transition-colors ${
              viewMode === "grid" ? "bg-slate-800 text-white" : "bg-white text-slate-400 hover:text-slate-600"
            }`}
            title="갤러리 보기"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
