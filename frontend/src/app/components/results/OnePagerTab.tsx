import type { MatchedAnnouncement, CompanyFormData } from "../../actions/recommend";
import { getDday } from "../../utils/announcement";
import { SignalBar } from "../ui/SignalBar";

function parseReceptionDates(period: string) {
  if (!period) return { start: null, end: null };
  const dates = period.match(/(\d{4}-\d{1,2}-\d{1,2})/g);
  return {
    start: dates?.[0] ? new Date(dates[0]) : null,
    end: dates?.[1] ? new Date(dates[1]) : (dates?.[0] ? new Date(dates[0]) : null),
  };
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function buildChecklist(match: MatchedAnnouncement, company: CompanyFormData) {
  const a = match.announcement;
  const items: { label: string; value: string; status: "pass" | "warn" | "unknown" }[] = [];

  if (a.region) {
    const regionMatch = a.region === "전국" || (company.address && a.region.split(",").some((r) => company.address.includes(r.trim())));
    items.push({
      label: "지역",
      value: `공고: ${a.region} / 기업: ${company.address ? company.address.split(" ").slice(0, 2).join(" ") : "미입력"}`,
      status: regionMatch ? "pass" : company.address ? "warn" : "unknown",
    });
  }

  if (a.bizExperience) {
    let bizVal = "미입력";
    if (company.established_date) {
      const years = Math.floor((Date.now() - new Date(company.established_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      bizVal = `${years}년차`;
    }
    items.push({
      label: "창업업력",
      value: `공고: ${a.bizExperience} / 기업: ${bizVal}`,
      status: company.established_date ? "pass" : "unknown",
    });
  }

  if (a.targetAge) {
    let ageVal = "미입력";
    if (company.ceo_birth_date) {
      const age = Math.floor((Date.now() - new Date(company.ceo_birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      ageVal = `만 ${age}세`;
    }
    items.push({
      label: "대상연령",
      value: `공고: ${a.targetAge} / 대표: ${ageVal}`,
      status: company.ceo_birth_date ? "pass" : "unknown",
    });
  }

  if (a.target) {
    items.push({
      label: "신청대상",
      value: a.target,
      status: "pass",
    });
  }

  return items;
}

/** API에 competition_level이 없을 때 (구 데이터) 클라이언트 사이드 추정 */
function estimateCompetition(a: MatchedAnnouncement["announcement"]): { level: number; reasons: string[] } {
  let score = 2.0; // 베이스라인: 정부지원사업은 기본적으로 경쟁 존재
  const reasons: string[] = [];

  // 조회수
  if (a.viewCount && a.viewCount >= 200) {
    score += a.viewCount >= 1000 ? 1.5 : a.viewCount >= 500 ? 1.0 : 0.5;
    reasons.push(`조회수 ${a.viewCount.toLocaleString()}회`);
  }

  // 지역 범위
  const region = (a.region || "").trim();
  if (!region || region === "전국" || region.includes("전국")) {
    score += 1.0;
    reasons.push("전국 대상");
  } else if (region.includes(",") || region.includes("·")) {
    score += 0.5;
  }

  // 자격제한
  let narrow = 0;
  if (a.targetAge) narrow++;
  if (a.bizExperience) narrow++;
  if (a.target && !a.target.includes("예비")) narrow++;
  if (narrow === 0) {
    score += 1.0;
    reasons.push("자격제한 없음");
  } else if (narrow === 1) {
    score += 0.5;
  }

  // 업력
  const biz = (a.bizExperience || "").trim();
  if (biz) {
    if (biz.includes("예비") || biz.includes("1년")) {
      score += 1.0;
      reasons.push("예비·초기창업 대상");
    } else if (biz.includes("3년")) {
      score += 0.5;
      reasons.push("3년 이내 대상");
    } else if (biz.includes("7년") || biz.includes("10년")) {
      score -= 0.5;
      reasons.push("업력 제한 있음");
    }
  }

  // 분야 인기도
  const popular = ["사업화", "R&D", "융자"];
  const niche = ["시설·공간", "멘토링·컨설팅", "행사·네트워크"];
  if (popular.some((f) => (a.supportField || "").includes(f))) {
    score += 0.5;
    reasons.push(`${a.supportField} 분야`);
  } else if (niche.some((f) => (a.supportField || "").includes(f))) {
    score -= 0.5;
  }

  // 마감임박
  const dday = getDday(a.receptionPeriod);
  if (dday !== null && dday >= 0 && dday <= 7) {
    score += 0.5;
    reasons.push("마감임박");
  }

  return { level: Math.max(1, Math.min(5, Math.round(score))), reasons };
}

function getVerdict(level: number): { text: string; sub: string; color: string; bg: string; border: string } {
  if (level >= 4) return { text: "신청 추천", sub: "귀사의 조건에 부합하는 공고입니다", color: "text-blue-800", bg: "bg-blue-50", border: "border-blue-200" };
  if (level >= 3) return { text: "검토 권장", sub: "일부 조건이 부합하며 세부 확인이 필요합니다", color: "text-slate-800", bg: "bg-slate-50", border: "border-slate-200" };
  return { text: "참고 사항", sub: "조건 부합도가 낮으나 참고할 수 있습니다", color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" };
}

export function OnePagerTab({
  match,
  company,
}: {
  match: MatchedAnnouncement;
  company: CompanyFormData;
}) {
  const a = match.announcement;
  const dday = getDday(a.receptionPeriod);
  const checklist = buildChecklist(match, company);
  const { start, end } = parseReceptionDates(a.receptionPeriod);
  const verdict = getVerdict(match.level);
  const today = new Date();

  // 경쟁 강도: API 값 우선, 없으면 클라이언트 추정
  const hasServerCompetition = match.competition_level && match.competition_level > 0;
  const competition = hasServerCompetition
    ? { level: match.competition_level!, reasons: match.competition_reasons ?? [] }
    : estimateCompetition(a);

  // 동적 섹션 번호
  let secNum = 0;
  const SEC_SUMMARY = ++secNum;
  const SEC_SCHEDULE = a.receptionPeriod ? ++secNum : 0;
  const SEC_CHECKLIST = checklist.length > 0 ? ++secNum : 0;
  const SEC_COMPETITION = ++secNum;
  const SEC_OVERVIEW = ++secNum;

  return (
    <div className="overflow-y-auto flex-1 bg-[#f8f8f6]">
      {/* 보고서 용지 */}
      <div className="max-w-[560px] mx-auto my-5 bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)] rounded-sm">

        {/* 문서 헤더 */}
        <div className="px-8 pt-8 pb-5 border-b border-slate-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] text-slate-400 tracking-widest uppercase mb-1">맞춤 분석 보고서</p>
              <h1 className="text-[15px] font-bold text-slate-900 leading-snug max-w-[380px]">
                {a.title}
              </h1>
            </div>
            <div className="text-right shrink-0 ml-4">
              <p className="text-[10px] text-slate-400">{fmtDate(today)}</p>
              <p className="text-[11px] font-semibold text-slate-700 mt-0.5">{company.company_name}</p>
            </div>
          </div>
        </div>

        {/* 판정 */}
        <div className={`mx-8 mt-6 p-4 rounded-lg border ${verdict.bg} ${verdict.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SignalBar level={match.level ?? (Math.ceil(match.score / 20) || 1)} size="lg" />
              <div>
                <p className={`text-base font-bold ${verdict.color}`}>{verdict.text}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{verdict.sub}</p>
              </div>
            </div>
            {dday !== null && dday >= 0 && (
              <div className={`text-center px-3 py-1.5 rounded-lg ${dday <= 7 ? "bg-red-50 border border-red-200" : "bg-white border border-slate-200"}`}>
                <p className={`text-lg font-bold leading-none ${dday <= 7 ? "text-red-600" : "text-slate-800"}`}>D-{dday}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">마감까지</p>
              </div>
            )}
          </div>
          {match.match_reasons.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-200/60">
              {match.match_reasons.map((reason, i) => (
                <span key={i} className="text-[11px] px-2 py-0.5 bg-white/80 text-slate-600 rounded border border-slate-200">
                  {reason}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 구분선 + 섹션 번호 스타일 */}
        <div className="px-8 mt-6 space-y-8 pb-8">

          {/* 1. AI 요약 */}
          <section>
            <SectionHead num={String(SEC_SUMMARY)} title="핵심 요약" />
            <div className="mt-2 p-4 bg-[#fafaf8] border border-dashed border-slate-300 rounded-lg">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" className="text-violet-500">
                    <path d="M8 1.5a1.5 1.5 0 011.5 1.5v1.55a4.5 4.5 0 012.45 2.45H13.5a1.5 1.5 0 010 3h-1.55a4.5 4.5 0 01-2.45 2.45V14a1.5 1.5 0 01-3 0v-1.55A4.5 4.5 0 014.05 10H2.5a1.5 1.5 0 010-3h1.55A4.5 4.5 0 016.5 4.55V3A1.5 1.5 0 018 1.5z" stroke="currentColor" strokeWidth="1.2" fill="none" />
                    <circle cx="8" cy="8.5" r="1.5" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <p className="text-[12px] text-slate-500 leading-relaxed">
                    이 공고의 핵심 내용, 예상 지원 혜택, 귀사에 맞는 신청 전략을 AI가 분석하여 제공합니다.
                  </p>
                  <span className="inline-block mt-2 text-[10px] px-2 py-0.5 bg-violet-50 text-violet-500 rounded border border-violet-200 font-medium">
                    OPEN 예정
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* 2. 일정 */}
          {a.receptionPeriod && (
            <section>
              <SectionHead num={String(SEC_SCHEDULE)} title="접수 일정" />
              <div className="mt-2">
                {start && end ? (
                  <div className="space-y-3">
                    <div className="flex items-center text-[12px] text-slate-600 gap-6">
                      <span>접수 시작 <strong className="text-slate-800 ml-1">{fmtDate(start)}</strong></span>
                      <span className="text-slate-300">|</span>
                      <span>접수 마감 <strong className={`ml-1 ${dday !== null && dday <= 7 ? "text-red-600" : "text-slate-800"}`}>{fmtDate(end)}</strong></span>
                    </div>
                    <TimelineBar start={start} end={end} />
                  </div>
                ) : (
                  <p className="text-[12px] text-slate-500">{a.receptionPeriod}</p>
                )}
              </div>
            </section>
          )}

          {/* 3. 자격 체크리스트 */}
          {checklist.length > 0 && (
            <section>
              <SectionHead num={String(SEC_CHECKLIST)} title="신청 자격 검토" />
              <table className="w-full mt-2 text-[12px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-1.5 pr-3 text-slate-400 font-medium w-[70px]">항목</th>
                    <th className="text-left py-1.5 pr-3 text-slate-400 font-medium">내용</th>
                    <th className="text-center py-1.5 text-slate-400 font-medium w-[50px]">결과</th>
                  </tr>
                </thead>
                <tbody>
                  {checklist.map((item, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-3 text-slate-700 font-medium align-top">{item.label}</td>
                      <td className="py-2 pr-3 text-slate-600 align-top">{item.value}</td>
                      <td className="py-2 text-center align-top">
                        {item.status === "pass" ? (
                          <span className="inline-block text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">충족</span>
                        ) : item.status === "warn" ? (
                          <span className="inline-block text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">확인</span>
                        ) : (
                          <span className="inline-block text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">미확인</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* 예상 경쟁 강도 */}
          <section>
            <SectionHead num={String(SEC_COMPETITION)} title="예상 경쟁 강도" />
            <CompetitionGauge level={competition.level} reasons={competition.reasons} />
          </section>

          {/* 사업 개요 */}
          <section>
            <SectionHead num={String(SEC_OVERVIEW)} title="사업 개요" />
            <table className="w-full mt-2 text-[12px]">
              <tbody>
                {[
                  ["지원분야", a.supportField],
                  ["주관기관", a.supervisionOrg],
                  ["지역", a.region],
                  ["담당부서", a.department],
                ].filter(([, v]) => v).map(([label, value], i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 pr-3 text-slate-400 font-medium w-[70px] align-top">{label}</td>
                    <td className="py-1.5 text-slate-700">{value}</td>
                  </tr>
                ))}
                {a.contact && (
                  <tr className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 pr-3 text-slate-400 font-medium w-[70px] align-top">연락처</td>
                    <td className="py-1.5 text-slate-700">{a.contact}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>

        {/* 문서 푸터 */}
        <div className="px-8 py-3 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[9px] text-slate-300">본 보고서는 공고 원문 기반 자동 분석 결과이며, 정확한 자격요건은 공고 상세를 확인하시기 바랍니다.</p>
        </div>
      </div>
    </div>
  );
}

const COMP_LABELS = ["", "매우 낮음", "낮음", "보통", "높음", "매우 높음"];
const COMP_COLORS = ["", "bg-blue-300", "bg-blue-400", "bg-amber-400", "bg-orange-400", "bg-red-400"];
const COMP_TEXT_COLORS = ["text-slate-400", "text-blue-600", "text-blue-700", "text-amber-700", "text-orange-700", "text-red-700"];

function CompetitionGauge({ level, reasons }: { level: number; reasons: string[] }) {
  const clamped = Math.max(1, Math.min(5, level));

  return (
    <div className="mt-2 space-y-3">
      <div className="space-y-1">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-sm ${
                i <= clamped ? COMP_COLORS[clamped] : "bg-slate-100"
              }`}
            />
          ))}
        </div>
        <p className={`text-[12px] font-bold mt-1 ${COMP_TEXT_COLORS[clamped]}`}>
          {COMP_LABELS[clamped]}
        </p>
      </div>

      {reasons.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {reasons.map((r, i) => (
            <span key={i} className="text-[11px] px-2 py-0.5 bg-slate-50 text-slate-500 rounded border border-slate-100">
              {r}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionHead({ num, title }: { num: string; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 w-4.5 h-4.5 inline-flex items-center justify-center rounded">
        {num}
      </span>
      <h3 className="text-[13px] font-bold text-slate-800">{title}</h3>
      <div className="flex-1 h-px bg-slate-100 ml-1" />
    </div>
  );
}

function TimelineBar({ start, end }: { start: Date; end: Date }) {
  const now = new Date();
  const total = end.getTime() - start.getTime();
  if (total <= 0) return null;

  const elapsed = Math.max(0, Math.min(total, now.getTime() - start.getTime()));
  const pct = Math.round((elapsed / total) * 100);
  const isOver = now > end;

  return (
    <div className="space-y-1">
      <div className="relative h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full rounded-full ${
            isOver ? "bg-slate-300" : pct > 80 ? "bg-orange-400" : "bg-blue-400"
          }`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
        {!isOver && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-blue-500 shadow-sm"
            style={{ left: `calc(${Math.min(96, pct)}% - 2px)` }}
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] text-slate-300">
        <span>시작</span>
        {!isOver && pct > 20 && pct < 80 && <span className="text-slate-500 font-medium">현재</span>}
        <span>마감</span>
      </div>
    </div>
  );
}
