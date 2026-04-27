"use client";

import { useEffect, useState } from "react";
import type { MatchedAnnouncement, CompanyFormData } from "../../actions/recommend";
import { getDday, getLevelLabel } from "../../utils/announcement";
import { SourceLogo } from "../ui/SourceLogo";
import { FieldBadge } from "../ui/FieldBadge";
import { DdayBadge } from "../ui/DdayBadge";
import { SignalBar } from "../ui/SignalBar";
import { DetailSection } from "../ui/DetailSection";
import { DetailRow } from "../ui/DetailRow";
import { ContactRow } from "../ui/ContactRow";
import { OnePagerTab } from "./OnePagerTab";

type Tab = "onepager" | "detail";

function getViewUrl(file: { downloadUrl: string; viewUrl?: string }) {
  if (file.viewUrl) return file.viewUrl;
  const m = file.downloadUrl.match(/\/afile\/fileDownload\/([^/?]+)/);
  if (m) return `https://www.k-startup.go.kr/web/cskin/jobJson.do?reqFileSqno=${m[1]}`;
  return "";
}

export function AnnouncementDetailModal({
  match,
  company,
  onClose,
}: {
  match: MatchedAnnouncement;
  company: CompanyFormData;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("onepager");
  const a = match.announcement;
  const dday = getDday(a.receptionPeriod);
  const isKStartup = a.source === "K-Startup";

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const previewFile = a.attachments?.find((f) => getViewUrl(f));
  const previewUrl = previewFile ? getViewUrl(previewFile) : "";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className={`relative bg-white w-full max-w-2xl mx-4 my-8 rounded-2xl shadow-2xl overflow-hidden max-h-[calc(100vh-4rem)] flex flex-col ring-1 ${
          isKStartup ? "ring-indigo-200" : "ring-teal-200"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`h-1 w-full ${isKStartup ? "bg-indigo-500" : "bg-teal-500"}`} />

        {/* 헤더 */}
        <div className={`sticky top-0 z-10 px-6 pt-4 pb-0 border-b ${
          isKStartup ? "bg-indigo-50/50 border-indigo-100" : "bg-teal-50/50 border-teal-100"
        }`}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <SourceLogo source={a.source} size="md" />
                <FieldBadge field={a.supportField} size="md" />
                <DdayBadge dday={dday} size="md" />
              </div>
              <h2 className="text-base font-bold text-slate-900 leading-snug">{a.title}</h2>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/60 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* 탭 */}
          <div className="flex gap-0 -mb-px">
            <button
              onClick={() => setTab("onepager")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === "onepager"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              한눈에 보기
            </button>
            <button
              onClick={() => setTab("detail")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === "detail"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              공고 상세
            </button>
          </div>
        </div>

        {/* 탭 본문 */}
        {tab === "onepager" ? (
          <OnePagerTab match={match} company={company} />
        ) : (
          <DetailTabContent
            match={match}
            isKStartup={isKStartup}
            previewUrl={previewUrl}
          />
        )}

        {/* 하단 액션 바 */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-3 flex gap-2">
          {a.detailUrl && (
            <a
              href={a.detailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors ${
                isKStartup ? "bg-indigo-600 hover:bg-indigo-700" : "bg-teal-600 hover:bg-teal-700"
              }`}
            >
              <SourceLogo source={a.source} />
              {isKStartup ? "K-Startup에서 신청하기" : "기업마당에서 신청하기"}
            </a>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailTabContent({
  match,
  isKStartup,
  previewUrl,
}: {
  match: MatchedAnnouncement;
  isKStartup: boolean;
  previewUrl: string;
}) {
  const a = match.announcement;

  return (
    <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
      {/* 적합도 */}
      <div className="flex items-center gap-4 bg-blue-50 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <SignalBar level={match.level ?? (Math.ceil(match.score / 20) || 1)} size="lg" />
          <span className="text-sm font-semibold text-slate-600">
            {getLevelLabel(match.level)}
          </span>
        </div>
        {match.match_reasons.length > 0 && (
          <div className="flex-1 flex flex-wrap gap-1.5">
            {match.match_reasons.map((reason, i) => (
              <span key={i} className="text-xs px-2 py-0.5 bg-white/70 text-blue-700 rounded-full">
                {reason}
              </span>
            ))}
          </div>
        )}
      </div>

      <DetailSection title="접수 정보">
        <DetailRow label="접수기간" value={a.receptionPeriod} />
      </DetailSection>

      {(a.target || a.targetAge || a.bizExperience) && (
        <DetailSection title="신청 자격">
          <DetailRow label="대상" value={a.target} />
          <DetailRow label="대상연령" value={a.targetAge} />
          <DetailRow label="창업업력" value={a.bizExperience} />
        </DetailSection>
      )}

      <DetailSection title="사업 정보">
        <DetailRow label="지원분야" value={a.supportField} />
        <DetailRow label="지역" value={a.region} />
        {isKStartup ? (
          <>
            <DetailRow label="기관구분" value={a.orgType} />
            <DetailRow label="주관기관" value={a.supervisionOrg} />
            <DetailRow label="담당부서" value={a.department} />
          </>
        ) : (
          <>
            <DetailRow label="소관부처" value={a.department} />
            <DetailRow label="사업수행기관" value={a.supervisionOrg} />
          </>
        )}
        {a.contact && <ContactRow contact={a.contact} />}
      </DetailSection>

      {a.contentText && (
        <DetailSection title={isKStartup ? "공고 내용" : "사업개요"}>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {a.contentText}
          </p>
        </DetailSection>
      )}

      {previewUrl ? (
        <DetailSection title="공고 미리보기">
          <div className="relative rounded-lg border border-slate-200 overflow-hidden bg-white">
            <iframe src={previewUrl} className="w-full h-[500px] border-0" title="공고 미리���기" />
          </div>
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-xs text-slate-500 hover:text-blue-600 transition-colors"
          >
            새 탭에서 보기
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M6 3H3v10h10v-3M9 2h5v5M14 2L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </DetailSection>
      ) : match.announcement.detailUrl ? (
        <DetailSection title="원문 보기">
          <a
            href={match.announcement.detailUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
              <path d="M6 3H3v10h10v-3M9 2h5v5M14 2L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            공고 원문 새 탭에서 보기
          </a>
        </DetailSection>
      ) : null}

      {a.attachments && a.attachments.length > 0 && (
        <DetailSection title={`첨부파일 (${a.attachments.length}건)`}>
          <ul className="space-y-1.5">
            {a.attachments.map((file, i) => (
              <li key={i}>
                <a
                  href={file.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors group"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-slate-400 group-hover:text-blue-500">
                    <path d="M7 1v9m0 0L4 7m3 3l3-3M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="break-all">{file.fileName}</span>
                </a>
              </li>
            ))}
          </ul>
        </DetailSection>
      )}
    </div>
  );
}
