"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import {
  extractWithTesseract,
  type OcrLocalResponse,
} from "../utils/ocr-local";
import {
  runRecommendation,
  type RecommendResponse,
  type CompanyFormData,
  type MatchedAnnouncement,
} from "../actions/recommend";
import { generateReport, type DownloadResult } from "../actions/download";

// ─── 메인 컴포넌트 ───

export function CompanyForm({
  step,
  onStepChange,
}: {
  step: 1 | 2 | 3;
  onStepChange: (s: 1 | 2 | 3) => void;
}) {
  const setStep = onStepChange;
  const [formData, setFormData] = useState<CompanyFormData>({
    company_name: "",
    ceo_name: "",
    ceo_birth_date: "",
    ceo_gender: "",
    address: "",
    established_date: "",
    main_industry: "",
    main_sector: "",
    business_item_summary: "",
  });
  const [ocrDone, setOcrDone] = useState(false);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [isPending, startTransition] = useTransition();
  const [ocrPending, setOcrPending] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [ocrRawText, setOcrRawText] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "deadline">("score");
  const [filterField, setFilterField] = useState("");

  function updateField(field: keyof CompanyFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  // OCR 처리 (Tesseract.js — 브라우저에서 실행, API 키 불필요)
  async function handleOcr(file: File) {
    setOcrPending(true);
    setOcrError("");
    try {
      const res: OcrLocalResponse = await extractWithTesseract(file);
      setOcrPending(false);

      if (!res.success) {
        setOcrError(res.error);
        return;
      }

      setOcrRawText(res.raw_text);
      console.log("=== OCR Raw Text ===\n", res.raw_text);

      setFormData((prev) => ({
        ...prev,
        company_name: res.data.company_name || prev.company_name,
        ceo_name: res.data.ceo_name || prev.ceo_name,
        address: res.data.address || prev.address,
        established_date: res.data.established_date || prev.established_date,
        main_industry: res.data.main_industry || prev.main_industry,
        main_sector: res.data.main_sector || prev.main_sector,
      }));
      setOcrDone(true);
    } catch (err) {
      setOcrPending(false);
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      setOcrError(`OCR 오류: ${message}`);
      console.error("OCR error:", err);
    }
  }

  // 추천 실행
  function handleSubmit() {
    startTransition(async () => {
      const res = await runRecommendation(formData);
      setResult(res);
      setStep(3);
    });
  }

  return (
    <div className="space-y-6">
      {/* Step 1: 업로드 / 직접 입력 선택 */}
      {step === 1 && (
        <div>
          {/* 위아래 2카드 */}
          {!ocrDone && !ocrPending ? (
            <div className="grid grid-rows-[1fr_auto_1fr] gap-4">
              {/* 위 — 드래그앤드롭 */}
              <UploadSection
                onFileSelect={handleOcr}
                isPending={ocrPending}
                error={ocrError}
                done={ocrDone}
              />

              {/* 구분선 */}
              <div className="flex items-center gap-4 px-4">
                <div className="flex-1 h-px bg-[#e8e8e4]" />
                <span className="text-xs font-medium text-[#91959B]">또는</span>
                <div className="flex-1 h-px bg-[#e8e8e4]" />
              </div>

              {/* 아래 — 직접 입력 */}
              <div
                onClick={() => setStep(2)}
                className="flex flex-col items-center justify-center rounded-2xl bg-white border border-[#e8e8e4] hover:border-[#131A1C]/30 cursor-pointer transition-all duration-200 hover:shadow-md p-10 group"
              >
                <div className="w-14 h-14 rounded-full bg-[#f7f7f5] group-hover:bg-yellow-300/20 flex items-center justify-center mb-4 transition-colors duration-200">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#131A1C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-[#131A1C] group-hover:text-[#131A1C] transition-colors">
                  직접 입력하기
                </h3>
                <p className="text-sm text-[#91959B] mt-1 text-center">
                  사업자등록증 없이 기업 정보를 직접 입력합니다
                </p>
              </div>
            </div>
          ) : (
            /* OCR 진행 중 / 완료 */
            <div className="space-y-4">
              <UploadSection
                onFileSelect={handleOcr}
                isPending={ocrPending}
                error={ocrError}
                done={ocrDone}
              />

              {ocrDone && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-emerald-800 mb-2">
                    추출된 정보
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm text-emerald-700">
                    {formData.company_name && <p>기업명: {formData.company_name}</p>}
                    {formData.ceo_name && <p>대표자: {formData.ceo_name}</p>}
                    {formData.address && <p>소재지: {formData.address}</p>}
                    {formData.established_date && <p>개업일: {formData.established_date}</p>}
                    {formData.main_industry && <p>업태: {formData.main_industry}</p>}
                    {formData.main_sector && <p>종목: {formData.main_sector}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="mt-3 w-full py-2.5 rounded-xl bg-[#131A1C] text-white text-sm font-semibold hover:bg-[#2a3035] transition-colors active:scale-[0.98]"
                  >
                    다음: 추가 정보 입력
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 2: 나머지 정보 입력 + 수정 */}
      {step === 2 && (
        <div className="space-y-6">
          {/* 기업 기본 정보 */}
          <Section title="기업 기본 정보">
            <Field label="기업명" required>
              <input
                type="text"
                required
                value={formData.company_name}
                onChange={(e) => updateField("company_name", e.target.value)}
                placeholder="예: CV기획"
                className="input"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="설립연월일">
                <input
                  type="date"
                  value={formData.established_date}
                  onChange={(e) =>
                    updateField("established_date", e.target.value)
                  }
                  className="input"
                />
              </Field>
              <Field label="소재지">
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  placeholder="서울특별시 강남구 테헤란로 123"
                  className="input"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="주업종">
                <input
                  type="text"
                  value={formData.main_industry}
                  onChange={(e) => updateField("main_industry", e.target.value)}
                  placeholder="예: 정보통신업"
                  className="input"
                />
              </Field>
              <Field label="주요산업">
                <input
                  type="text"
                  value={formData.main_sector}
                  onChange={(e) => updateField("main_sector", e.target.value)}
                  placeholder="예: AI/빅데이터"
                  className="input"
                />
              </Field>
            </div>
            <Field label="사업아이템 한줄 정리">
              <textarea
                rows={2}
                value={formData.business_item_summary}
                onChange={(e) =>
                  updateField("business_item_summary", e.target.value)
                }
                placeholder="예: AI 기반 영상 콘텐츠 자동 제작 솔루션"
                className="input resize-none"
              />
            </Field>
          </Section>

          {/* 대표자 정보 */}
          <Section title="대표자 정보">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="대표자명">
                <input
                  type="text"
                  value={formData.ceo_name}
                  onChange={(e) => updateField("ceo_name", e.target.value)}
                  placeholder="홍길동"
                  className="input"
                />
              </Field>
              <Field label="대표자 생년월일">
                <input
                  type="date"
                  value={formData.ceo_birth_date}
                  onChange={(e) =>
                    updateField("ceo_birth_date", e.target.value)
                  }
                  className="input"
                />
              </Field>
            </div>
            <Field label="대표자 성별">
              <div className="flex gap-4 mt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="ceo_gender"
                    value="M"
                    checked={formData.ceo_gender === "M"}
                    onChange={() => updateField("ceo_gender", "M")}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-[#131A1C]">남성</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="ceo_gender"
                    value="F"
                    checked={formData.ceo_gender === "F"}
                    onChange={() => updateField("ceo_gender", "F")}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-[#131A1C]">여성</span>
                </label>
              </div>
            </Field>
          </Section>

          <div className="flex gap-3 justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-8 py-3 bg-yellow-500 text-white text-sm font-semibold rounded-lg
                         hover:bg-[#2a3035] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              이전
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !formData.company_name}
              className="px-8 py-3 bg-[#131A1C] text-white text-sm font-semibold rounded-lg
                         hover:bg-[#2a3035] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {isPending ? "매칭 분석 중..." : "맞춤 추천 받기"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: 추천 결과 */}
      {step === 3 && result && (
        <div className="space-y-6">
          {result.success ? (
            <ResultsView
              result={result}
              sortBy={sortBy}
              onSortChange={setSortBy}
              filterField={filterField}
              onFilterChange={setFilterField}
              onEditCondition={() => setStep(2)}
              formData={formData}
              onRefreshComplete={(res) => setResult(res)}
            />
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
              <div className="flex items-center justify-between">
                <span>{result.error}</span>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="ml-3 px-4 py-1.5 text-xs font-medium text-[#131A1C] border border-[#e8e8e4] rounded-lg hover:bg-[#f7f7f5] shrink-0"
                >
                  조건 수정하기
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 업로드 섹션 ───

function UploadSection({
  onFileSelect,
  isPending,
  error,
  done,
}: {
  onFileSelect: (file: File) => void;
  isPending: boolean;
  error: string;
  done: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith("image/") || file.type === "application/pdf")) onFileSelect(file);
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    setDragging(true);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setDragging(false);
  }

  // 파일 아이콘 그룹 (문서/이미지/음표 — 레퍼런스 스타일)
  const FileIcons = () => (
    <div className="relative w-24 h-20 mx-auto">
      {/* 왼쪽 문서 (재생 아이콘) */}
      <svg className="absolute left-0 top-2 upload-file-icon" width="30" height="38" viewBox="0 0 30 38" fill="none" stroke="#131A1C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="1" width="24" height="32" rx="3" fill="white" />
        <circle cx="13" cy="17" r="6" />
        <polygon points="11,14 11,20 16,17" fill="#131A1C" stroke="none" />
      </svg>
      {/* 가운데 이미지 */}
      <svg className="absolute left-7 top-0 z-10 upload-file-icon-center" width="34" height="42" viewBox="0 0 34 42" fill="none" stroke="#131A1C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="1" width="28" height="36" rx="3" fill="white" />
        <path d="M8 8h4v4H8z" fill="#131A1C" stroke="none" rx="0.5" />
        <polyline points="1,30 10,22 16,28 22,20 29,28" strokeWidth="1.5" />
      </svg>
      {/* 오른쪽 문서 (음표) */}
      <svg className="absolute right-0 top-2 upload-file-icon" width="30" height="38" viewBox="0 0 30 38" fill="none" stroke="#131A1C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 1H5a4 4 0 00-4 4v24a4 4 0 004 4h16a4 4 0 004-4V7l-6-6z" fill="white" />
        <path d="M19 1v6h6" />
        <circle cx="11" cy="22" r="3" />
        <path d="M14 22V12l6-2" />
      </svg>
    </div>
  );

  // 체크 아이콘
  const CheckIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );

  return (
    <div className="upload-outer-card rounded-2xl p-5 select-none flex-1 flex flex-col">
      {/* 내부 dashed 영역 */}
      <div
        onDrop={handleDrop}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isPending && !done && fileRef.current?.click()}
        className={`relative rounded-xl py-10 px-8 text-center transition-all duration-300 cursor-pointer border-2 border-dashed flex-1 flex flex-col items-center justify-center ${
          dragging
            ? "bg-[#FFFDE6] border-[#131A1C] upload-dashed-active"
            : done
              ? "bg-emerald-50 border-emerald-300"
              : isPending
                ? "bg-white border-[#131A1C]/30"
                : "bg-white border-[#D5D5D5] hover:border-[#131A1C]/40"
        }`}
      >
        {/* 아이콘 영역 */}
        <div className="flex justify-center mb-5">
          {isPending ? (
            <div className="w-16 h-16 rounded-full bg-[#131A1C] flex items-center justify-center">
              <div className="w-7 h-7 border-3 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          ) : done ? (
            <div className="w-16 h-16 rounded-full bg-[#22c55e] flex items-center justify-center text-white upload-check-pop">
              <CheckIcon />
            </div>
          ) : (
            <div className={dragging ? "upload-icon-dragging-bounce" : ""}>
              <FileIcons />
            </div>
          )}
        </div>

        {/* 텍스트 영역 */}
        {dragging ? (
          <div className="pointer-events-none">
            <h3 className="text-xl font-bold text-[#131A1C] upload-fade-in">
              여기에 놓으세요
            </h3>
            <p className="text-sm text-[#91959B] mt-2 upload-fade-in-delay">
              파일을 놓으면 바로 분석을 시작합니다
            </p>
          </div>
        ) : isPending ? (
          <div>
            <h3 className="text-xl font-bold text-[#131A1C]">분석 중...</h3>
            <p className="text-sm text-[#91959B] mt-2">
              사업자등록증에서 정보를 추출하고 있습니다
            </p>
          </div>
        ) : done ? (
          <div>
            <h3 className="text-xl font-bold text-[#131A1C] upload-fade-in">
              인식 완료
            </h3>
            <p className="text-sm text-[#91959B] mt-2 upload-fade-in-delay">
              아래에서 추출된 정보를 확인하세요 /{" "}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileRef.current?.click();
                }}
                className="text-[#131A1C] font-medium hover:underline"
              >
                다시 업로드
              </button>
            </p>
          </div>
        ) : (
          <div>
            <h3 className="text-xl font-bold text-[#131A1C] tracking-tight leading-snug">
              Drag & drop{" "}
              <span className="text-[#131A1C]">사업자등록증</span>
              <span className="text-[#131A1C]">,</span>
              <br />
              <span className="text-[#131A1C]">이미지</span>
              <span className="text-[#91959B]"> 또는 </span>
              <span className="text-[#131A1C]">PDF</span>
            </h3>
            <p className="text-sm text-[#91959B] mt-3">
              또는{" "}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileRef.current?.click();
                }}
                className="text-[#131A1C] underline underline-offset-2 font-medium hover:text-[#000]"
              >
                파일 선택
              </button>
              으로 업로드하세요
            </p>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={handleChange}
        className="hidden"
      />
      {error && (
        <p className="mt-4 text-sm text-center text-red-500 upload-fade-in">{error}</p>
      )}
    </div>
  );
}

// ─── 추천 결과 뷰 ───

function ResultsView({
  result,
  sortBy,
  onSortChange,
  filterField,
  onFilterChange,
  onEditCondition,
  formData,
  onRefreshComplete,
}: {
  result: Extract<RecommendResponse, { success: true }>;
  sortBy: "score" | "deadline";
  onSortChange: (v: "score" | "deadline") => void;
  filterField: string;
  onFilterChange: (v: string) => void;
  onEditCondition: () => void;
  formData: CompanyFormData;
  onRefreshComplete: (res: RecommendResponse) => void;
}) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [refreshPending, setRefreshPending] = useState(false);
  const [progressMessages, setProgressMessages] = useState<
    { step: string; message: string }[]
  >([]);
  const [detailMatch, setDetailMatch] = useState<MatchedAnnouncement | null>(null);
  const [filterRegion, setFilterRegion] = useState("");
  const [filterDeadline, setFilterDeadline] = useState("");
  const [filterOrg, setFilterOrg] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const crawledDate = result.crawled_at
    ? new Date(result.crawled_at).toLocaleDateString("ko-KR")
    : "";

  // 캐시 나이 계산
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
    return diffMs > 7 * 24 * 60 * 60 * 1000; // 7일 이상
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
            setProgressMessages((prev) => [
              ...prev,
              { step: event.step, message: event.message },
            ]);
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
    const res: DownloadResult = await generateReport(
      result.company.company_name,
      format
    );
    setDownloading(null);

    if (!res.success) {
      alert(res.error);
      return;
    }

    // base64 → Blob → 다운로드
    const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: res.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = res.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 필터 옵션 목록 추출
  const fields = Array.from(
    new Set(result.matches.map((m) => m.announcement.supportField).filter(Boolean))
  );
  const regions = Array.from(
    new Set(result.matches.map((m) => m.announcement.region).filter(Boolean))
  ).sort();
  const orgs = Array.from(
    new Set(result.matches.map((m) => m.announcement.supervisionOrg).filter(Boolean))
  ).sort();

  // 필터 적용
  let filtered = result.matches;
  if (filterField) {
    filtered = filtered.filter((m) => m.announcement.supportField === filterField);
  }
  if (filterRegion) {
    filtered = filtered.filter((m) => m.announcement.region.includes(filterRegion));
  }
  if (filterDeadline) {
    const now = Date.now();
    filtered = filtered.filter((m) => {
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
    filtered = filtered.filter((m) => m.announcement.supervisionOrg === filterOrg);
  }

  const hasActiveFilter = !!(filterField || filterRegion || filterDeadline || filterOrg);

  // 정렬
  if (sortBy === "deadline") {
    filtered = [...filtered].sort((a, b) => {
      const aEnd = parsePeriodEnd(a.announcement.receptionPeriod);
      const bEnd = parsePeriodEnd(b.announcement.receptionPeriod);
      return (aEnd?.getTime() ?? Infinity) - (bEnd?.getTime() ?? Infinity);
    });
  }

  return (
    <div className="space-y-4">
      {/* 요약 */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {result.company.company_name} 맞춤 추천 결과
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              전체 {result.total_announcements}건 중{" "}
              <span className="font-semibold text-blue-600">
                {result.recommended_count}건
              </span>{" "}
              추천
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
            onClick={() => handleDownload("xlsx")}
            disabled={downloading !== null}
            className="px-4 py-2 text-xs font-medium bg-green-600 text-white rounded-lg
                       hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {downloading === "xlsx" ? "생성 중..." : "Excel 다운로드"}
          </button>
          <button
            type="button"
            onClick={() => handleDownload("pdf")}
            disabled={downloading !== null}
            className="px-4 py-2 text-xs font-medium bg-slate-700 text-white rounded-lg
                       hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {downloading === "pdf" ? "생성 중..." : "PDF 다운로드"}
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshPending || downloading !== null}
            className="px-4 py-2 text-xs font-medium bg-amber-500 text-white rounded-lg
                       hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            {refreshPending ? "크롤링 중..." : "최신 데이터로 추천받기"}
          </button>
          <button
            type="button"
            onClick={onEditCondition}
            className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg
                       hover:bg-slate-50 transition-colors ml-auto"
          >
            조건 수정하기
          </button>
        </div>
      </div>

      {/* 데이터 최신화 경고 배너 */}
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
            className="shrink-0 px-4 py-1.5 text-xs font-semibold bg-amber-500 text-white rounded-lg
                       hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            {refreshPending ? "크롤링 중..." : "지금 최신화"}
          </button>
        </div>
      )}

      {/* 필터/정렬 바 */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* 정렬 스위치 */}
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
        {/* 필터 드롭다운들 */}
        {fields.length > 1 && (
          <select
            value={filterField}
            onChange={(e) => onFilterChange(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="">전체 분야</option>
            {fields.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        )}
        {regions.length > 1 && (
          <select
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="">전체 지역</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        )}
        <select
          value={filterDeadline}
          onChange={(e) => setFilterDeadline(e.target.value)}
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
            onChange={(e) => setFilterOrg(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="">전체 주관처</option>
            {orgs.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => {
                onFilterChange("");
                setFilterRegion("");
                setFilterDeadline("");
                setFilterOrg("");
              }}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              필터 초기화
            </button>
          )}
          {/* 뷰 모드 토글 */}
          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode("list")}
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
              onClick={() => setViewMode("grid")}
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

      {/* 카드 리스트 */}
      <div className={
        viewMode === "grid"
          ? "grid grid-cols-2 gap-3"
          : "space-y-3"
      }>
        {filtered.map((m) => (
          <MatchCard
            key={m.announcement.pbancSn || m.rank}
            match={m}
            onOpenDetail={setDetailMatch}
            compact={viewMode === "grid"}
          />
        ))}
        {filtered.length === 0 && (
          <p className={`text-center text-sm text-slate-400 py-8 ${viewMode === "grid" ? "col-span-2" : ""}`}>
            조건에 맞는 공고가 없습니다
          </p>
        )}
      </div>

      {/* 공고 상세 모달 */}
      {detailMatch && (
        <AnnouncementDetailModal
          match={detailMatch}
          onClose={() => setDetailMatch(null)}
        />
      )}

      {/* 크롤링 진행 상황 배너 */}
      {refreshPending && (
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <div className="bg-white/95 backdrop-blur border-t border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] px-6 py-4 max-w-2xl mx-auto rounded-t-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin shrink-0" />
              <p className="text-sm font-semibold text-slate-800">
                최신 공고를 수집하고 있습니다
              </p>
            </div>
            <div className="space-y-1.5 pl-8">
              {progressMessages.map((msg, i) => {
                const isLatest = i === progressMessages.length - 1;
                const isDone = msg.step.endsWith("_done");
                const isError = msg.step.endsWith("_error");
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 text-xs transition-opacity ${
                      isLatest ? "opacity-100" : "opacity-50"
                    }`}
                  >
                    {isDone ? (
                      <span className="text-green-500 text-sm">&#10003;</span>
                    ) : isError ? (
                      <span className="text-red-400 text-sm">&#10007;</span>
                    ) : isLatest ? (
                      <span className="w-3 h-3 border border-blue-300 border-t-blue-600 rounded-full animate-spin shrink-0" />
                    ) : (
                      <span className="text-green-500 text-sm">&#10003;</span>
                    )}
                    <span
                      className={
                        isDone
                          ? "text-green-700"
                          : isError
                            ? "text-red-600"
                            : isLatest
                              ? "text-slate-700"
                              : "text-slate-500"
                      }
                    >
                      {msg.message}
                    </span>
                  </div>
                );
              })}
              {progressMessages.length === 0 && (
                <p className="text-xs text-slate-400">연결 중...</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 개별 공고 카드 ───

function SourceLogo({ source, size = "sm" }: { source: string; size?: "sm" | "md" }) {
  const isK = source === "K-Startup";
  const h = size === "sm" ? "h-4" : "h-5";
  return (
    <img
      src={isK ? "/logo-kstartup.png" : "/logo-bizinfo.png"}
      alt={isK ? "K-Startup" : "기업마당"}
      className={`${h} w-auto object-contain shrink-0`}
    />
  );
}

function SignalBar({ level, size = "sm" }: { level: number; size?: "sm" | "lg" }) {
  const barCount = 5;
  const clampedLevel = Math.max(1, Math.min(5, level));

  // 레벨별 색상
  const color =
    clampedLevel >= 4
      ? "bg-blue-500"
      : clampedLevel >= 3
        ? "bg-blue-400"
        : clampedLevel >= 2
          ? "bg-slate-400"
          : "bg-slate-300";

  const gap = size === "lg" ? "gap-[3px]" : "gap-[2px]";
  const barWidth = size === "lg" ? "w-[5px]" : "w-[4px]";
  const heights =
    size === "lg"
      ? ["h-[8px]", "h-[12px]", "h-[16px]", "h-[20px]", "h-[24px]"]
      : ["h-[6px]", "h-[9px]", "h-[12px]", "h-[15px]", "h-[18px]"];

  return (
    <div className={`flex items-end ${gap}`} title={`적합도 ${clampedLevel}/5`}>
      {Array.from({ length: barCount }, (_, i) => {
        const active = i < clampedLevel;
        return (
          <div
            key={i}
            className={`${barWidth} ${heights[i]} rounded-sm ${active ? color : "bg-slate-200"}`}
          />
        );
      })}
    </div>
  );
}


function MatchCard({
  match,
  onOpenDetail,
  compact = false,
}: {
  match: MatchedAnnouncement;
  onOpenDetail: (m: MatchedAnnouncement) => void;
  compact?: boolean;
}) {
  const a = match.announcement;
  const dday = getDday(a.receptionPeriod);
  const isKStartup = a.source === "K-Startup";

  if (compact) {
    return (
      <div
        className={`relative bg-white rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden border flex flex-col ${
          isKStartup
            ? "border-indigo-100 hover:border-indigo-200"
            : "border-teal-100 hover:border-teal-200"
        }`}
        onClick={() => onOpenDetail(match)}
      >
        {/* 상단 출처 컬러 바 */}
        <div className={`h-1 w-full ${isKStartup ? "bg-indigo-500" : "bg-teal-500"}`} />
        <div className="p-3 flex flex-col flex-1">
          {/* 뱃지 + 시그널 */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1 flex-wrap min-w-0">
              <SourceLogo source={a.source} />
              {dday !== null && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    dday <= 3
                      ? "bg-red-100 text-red-700"
                      : dday <= 7
                        ? "bg-orange-100 text-orange-700"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {dday === 0 ? "D-Day" : dday > 0 ? `D-${dday}` : "마감"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <SignalBar level={match.level ?? (Math.ceil(match.score / 20) || 1)} />
              <span className={`text-[10px] font-medium ${
                (match.level ?? 0) >= 4 ? "text-blue-500" : (match.level ?? 0) >= 3 ? "text-blue-400" : "text-slate-400"
              }`}>
                {(match.level ?? 0) >= 5 ? "매우높음" : (match.level ?? 0) >= 4 ? "높음" : (match.level ?? 0) >= 3 ? "보통" : (match.level ?? 0) >= 2 ? "낮음" : "미약"}
              </span>
            </div>
          </div>
          {/* 제목 */}
          <h3 className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2 flex-1">
            {a.title}
          </h3>
          {/* 메타 */}
          <div className="mt-2 space-y-0.5 text-[10px] text-slate-400">
            {a.receptionPeriod && <p className="truncate">접수: {a.receptionPeriod}</p>}
            {a.supervisionOrg && <p className="truncate">주관: {a.supervisionOrg}</p>}
            {a.region && <p className="truncate">지역: {a.region}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative bg-white rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden border ${
        isKStartup
          ? "border-indigo-100 hover:border-indigo-200"
          : "border-teal-100 hover:border-teal-200"
      }`}
      onClick={() => onOpenDetail(match)}
    >
      {/* 좌측 출처 컬러 바 */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${
          isKStartup ? "bg-indigo-500" : "bg-teal-500"
        }`}
      />

      <div className="pl-4 pr-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* 뱃지 행 */}
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <SourceLogo source={a.source} />
              {a.supportField && (
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">
                  {a.supportField}
                </span>
              )}
              {dday !== null && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    dday <= 3
                      ? "bg-red-100 text-red-700"
                      : dday <= 7
                        ? "bg-orange-100 text-orange-700"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {dday === 0 ? "D-Day" : dday > 0 ? `D-${dday}` : "마감"}
                </span>
              )}
            </div>
            {/* 제목 */}
            <h3 className="text-sm font-semibold text-slate-900 leading-snug">
              {a.title}
            </h3>
            {/* 메타 정보 */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
              {a.supervisionOrg && <span>주관: {a.supervisionOrg}</span>}
              {a.receptionPeriod && <span>접수: {a.receptionPeriod}</span>}
              {a.region && <span>지역: {a.region}</span>}
            </div>
          </div>
          {/* 시그널 바 */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <SignalBar level={match.level ?? (Math.ceil(match.score / 20) || 1)} />
            <span className={`text-[10px] font-medium ${
              (match.level ?? 0) >= 4 ? "text-blue-500" : (match.level ?? 0) >= 3 ? "text-blue-400" : "text-slate-400"
            }`}>
              {(match.level ?? 0) >= 5 ? "매우높음" : (match.level ?? 0) >= 4 ? "높음" : (match.level ?? 0) >= 3 ? "보통" : (match.level ?? 0) >= 2 ? "낮음" : "미약"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 공고 상세 모달 ───

function AnnouncementDetailModal({
  match,
  onClose,
}: {
  match: MatchedAnnouncement;
  onClose: () => void;
}) {
  const a = match.announcement;
  const dday = getDday(a.receptionPeriod);
  const isKStartup = a.source === "K-Startup";

  // ESC 키로 닫기
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      onClick={onClose}
    >
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* 모달 본체 */}
      <div
        className={`relative bg-white w-full max-w-2xl mx-4 my-8 rounded-2xl shadow-2xl overflow-hidden max-h-[calc(100vh-4rem)] flex flex-col ring-1 ${
          isKStartup ? "ring-indigo-200" : "ring-teal-200"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 출처 컬러 탑 바 */}
        <div className={`h-1 w-full ${isKStartup ? "bg-indigo-500" : "bg-teal-500"}`} />

        {/* 헤더 */}
        <div className={`sticky top-0 z-10 px-6 py-4 flex items-start justify-between gap-3 border-b ${
          isKStartup
            ? "bg-indigo-50/50 border-indigo-100"
            : "bg-teal-50/50 border-teal-100"
        }`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <SourceLogo source={a.source} size="md" />
              {a.supportField && (
                <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">
                  {a.supportField}
                </span>
              )}
              {dday !== null && (
                <span
                  className={`text-xs px-2 py-0.5 rounded font-bold ${
                    dday <= 3
                      ? "bg-red-100 text-red-700"
                      : dday <= 7
                        ? "bg-orange-100 text-orange-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {dday === 0 ? "D-Day" : dday > 0 ? `D-${dday}` : "마감"}
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-slate-900 leading-snug">
              {a.title}
            </h2>
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

        {/* 스크롤 본문 */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* 적합도 */}
          <div className="flex items-center gap-4 bg-blue-50 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <SignalBar level={match.level ?? (Math.ceil(match.score / 20) || 1)} size="lg" />
              <span className="text-sm font-semibold text-slate-600">
                {match.level >= 5 ? "매우 높음" : match.level >= 4 ? "높음" : match.level >= 3 ? "보통" : match.level >= 2 ? "낮음" : "미약"}
              </span>
            </div>
            {match.match_reasons.length > 0 && (
              <div className="flex-1 flex flex-wrap gap-1.5">
                {match.match_reasons.map((reason, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-0.5 bg-white/70 text-blue-700 rounded-full"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 접수 정보 */}
          <DetailSection title="접수 정보">
            <DetailRow label="접수기간" value={a.receptionPeriod} />
            {a.detailUrl && (
              <DetailRow label={isKStartup ? "원문 바로가기" : "사업신청 사이트"}>
                <a
                  href={a.detailUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline break-all"
                >
                  {isKStartup ? "K-Startup에서 보기" : "기업마당에서 보기"} &rarr;
                </a>
              </DetailRow>
            )}
          </DetailSection>

          {/* 신청 자격 — K-Startup에만 구조화 데이터 */}
          {(a.target || a.targetAge || a.bizExperience) && (
            <DetailSection title="신청 자격">
              <DetailRow label="대상" value={a.target} />
              <DetailRow label="대상연령" value={a.targetAge} />
              <DetailRow label="창업업력" value={a.bizExperience} />
            </DetailSection>
          )}

          {/* 사업 정보 */}
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
            <DetailRow label="연락처" value={a.contact} />
          </DetailSection>

          {/* 사업 개요 (contentText) */}
          {a.contentText && (
            <DetailSection title={isKStartup ? "공고 내용" : "사업개요"}>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {a.contentText}
              </p>
            </DetailSection>
          )}

          {/* 첨부파일 */}
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
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        className="shrink-0 text-slate-400 group-hover:text-blue-500"
                      >
                        <path
                          d="M7 1v9m0 0L4 7m3 3l3-3M2 12h10"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="break-all">{file.fileName}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </DetailSection>
          )}
        </div>

        {/* 하단 액션 바 */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-3 flex gap-2">
          {a.detailUrl && (
            <a
              href={a.detailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors ${
                isKStartup
                  ? "bg-indigo-600 hover:bg-indigo-700"
                  : "bg-teal-600 hover:bg-teal-700"
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

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        {title}
      </h3>
      <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  if (!value && !children) return null;
  return (
    <div className="flex gap-3 text-sm">
      <span className="shrink-0 w-20 text-slate-500 font-medium">{label}</span>
      <span className="text-slate-800 flex-1">
        {children || value}
      </span>
    </div>
  );
}

// ─── 유틸리티 ───

function parsePeriodEnd(period: string): Date | null {
  if (!period) return null;
  const dates = period.match(/(\d{4}-\d{1,2}-\d{1,2})/g);
  if (dates && dates.length >= 2) return new Date(dates[1]);
  if (dates && dates.length === 1) return new Date(dates[0]);
  return null;
}

function getDday(period: string): number | null {
  const end = parsePeriodEnd(period);
  if (!end) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="bg-white rounded-xl border border-[#e8e8e4] p-6 space-y-4 shadow-sm">
      <legend className="text-base font-semibold text-[#131A1C] px-1">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#676C73] mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
