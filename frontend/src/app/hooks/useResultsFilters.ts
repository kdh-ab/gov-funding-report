import { useState, useMemo } from "react";
import type { MatchedAnnouncement } from "../actions/recommend";
import { parsePeriodEnd } from "../utils/announcement";

export function useResultsFilters(matches: MatchedAnnouncement[] = []) {
  const [sortBy, setSortBy] = useState<"score" | "deadline">("score");
  const [filterField, setFilterField] = useState("");
  const [filterRegion, setFilterRegion] = useState("");
  const [filterDeadline, setFilterDeadline] = useState("");
  const [filterOrg, setFilterOrg] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

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

  const filtered = useMemo(() => {
    let result = matches;

    if (filterField) {
      result = result.filter((m) => m.announcement.supportField === filterField);
    }
    if (filterRegion) {
      result = result.filter((m) => m.announcement.region.includes(filterRegion));
    }
    if (filterDeadline) {
      const now = Date.now();
      result = result.filter((m) => {
        const end = parsePeriodEnd(m.announcement.receptionPeriod);
        if (!end) return filterDeadline === "unknown";
        const days = Math.ceil((end.getTime() - now) / (1000 * 60 * 60 * 24));
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
  }, [matches, filterField, filterRegion, filterDeadline, filterOrg, sortBy]);

  function clearFilters() {
    setFilterField("");
    setFilterRegion("");
    setFilterDeadline("");
    setFilterOrg("");
  }

  return {
    sortBy, setSortBy,
    filterField, setFilterField,
    filterRegion, setFilterRegion,
    filterDeadline, setFilterDeadline,
    filterOrg, setFilterOrg,
    viewMode, setViewMode,
    fields, regions, orgs,
    hasActiveFilter,
    filtered,
    clearFilters,
  };
}
