import { useState, useMemo } from "react";
import type { MatchedAnnouncement } from "../actions/recommend";
import { parsePeriodEnd } from "../utils/announcement";

const PAGE_SIZE = 10;

export function useResultsFilters(matches: MatchedAnnouncement[] = [], selectedDeadlineDate: string | null = null) {
  const [sortBy, setSortBy] = useState<"score" | "deadline">("score");
  const [filterField, setFilterField] = useState("");
  const [filterRegion, setFilterRegion] = useState("");
  const [filterDeadline, setFilterDeadline] = useState("");
  const [filterOrg, setFilterOrg] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [page, setPage] = useState(1);
  const [referenceNow] = useState(() => Date.now());

  const fields = useMemo(
    () => Array.from(new Set(matches.map((m) => m.announcement.supportField).filter(Boolean))),
    [matches]
  );

  const regions = useMemo(
    () => Array.from(new Set(matches.map((m) => m.announcement.region).filter(Boolean))).sort(),
    [matches]
  );

  const orgs = useMemo(
    () => Array.from(new Set(matches.map((m) => m.announcement.supervisionOrg).filter(Boolean))).sort(),
    [matches]
  );

  const hasActiveFilter = !!(filterField || filterRegion || filterDeadline || filterOrg);

  // 필터 변경 시 페이지 리셋 래퍼
  function setFilterFieldR(v: string)   { setFilterField(v);   setPage(1); }
  function setFilterRegionR(v: string)  { setFilterRegion(v);  setPage(1); }
  function setFilterDeadlineR(v: string){ setFilterDeadline(v); setPage(1); }
  function setFilterOrgR(v: string)     { setFilterOrg(v);     setPage(1); }
  function setSortByR(v: "score" | "deadline") { setSortBy(v); setPage(1); }

  const filtered = useMemo(() => {
    let result = matches;

    // 특정 날짜의 마감 공고 필터
    if (selectedDeadlineDate) {
      result = result.filter((m) => {
        const end = parsePeriodEnd(m.announcement.receptionPeriod);
        if (!end) return false;
        const endDateStr = end.toISOString().split("T")[0];
        return endDateStr === selectedDeadlineDate;
      });
    }

    if (filterField) {
      result = result.filter((m) => m.announcement.supportField === filterField);
    }
    if (filterRegion) {
      result = result.filter((m) => m.announcement.region.includes(filterRegion));
    }
    if (filterDeadline) {
      result = result.filter((m) => {
        const end = parsePeriodEnd(m.announcement.receptionPeriod);
        if (!end) return filterDeadline === "unknown";
        const days = Math.ceil((end.getTime() - referenceNow) / (1000 * 60 * 60 * 24));
        if (filterDeadline === "7") return days >= 0 && days <= 7;
        if (filterDeadline === "30") return days >= 0 && days <= 30;
        if (filterDeadline === "over30") return days > 30;
        return true;
      });
    }
    if (filterOrg) {
      result = result.filter((m) => m.announcement.supervisionOrg === filterOrg);
    }

    if (sortBy === "deadline") {
      result = [...result].sort((a, b) => {
        const aEnd = parsePeriodEnd(a.announcement.receptionPeriod);
        const bEnd = parsePeriodEnd(b.announcement.receptionPeriod);
        return (aEnd?.getTime() ?? Infinity) - (bEnd?.getTime() ?? Infinity);
      });
    }

    return result;
  }, [matches, selectedDeadlineDate, filterField, filterRegion, filterDeadline, filterOrg, sortBy, referenceNow]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function clearFilters() {
    setFilterField("");
    setFilterRegion("");
    setFilterDeadline("");
    setFilterOrg("");
    setPage(1);
  }

  return {
    sortBy,  setSortBy: setSortByR,
    filterField,    setFilterField:    setFilterFieldR,
    filterRegion,   setFilterRegion:   setFilterRegionR,
    filterDeadline, setFilterDeadline: setFilterDeadlineR,
    filterOrg,      setFilterOrg:      setFilterOrgR,
    viewMode, setViewMode,
    fields, regions, orgs,
    hasActiveFilter,
    filtered,
    paginated,
    page: safePage,
    totalPages,
    pageSize: PAGE_SIZE,
    setPage,
    clearFilters,
  };
}
