"use client";

import { useState, useTransition, useRef } from "react";
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

export function CompanyForm() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
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
      {/* 스텝 인디케이터 */}
      <div className="mb-4">
        <StepIndicator current={step} />
      </div>

      {/* Step 1: 사업자등록증 업로드 */}
      {step === 1 && (
        <div className="space-y-6">
          <UploadSection
            onFileSelect={handleOcr}
            isPending={ocrPending}
            error={ocrError}
            done={ocrDone}
          />

          {/* OCR 결과 미리보기 */}
          {ocrDone && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-green-800 mb-2">
                사업자등록증에서 추출된 정보
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm text-green-700">
                {formData.company_name && (
                  <p>기업명: {formData.company_name}</p>
                )}
                {formData.ceo_name && <p>대표자: {formData.ceo_name}</p>}
                {formData.address && <p>소재지: {formData.address}</p>}
                {formData.established_date && (
                  <p>개업일: {formData.established_date}</p>
                )}
                {formData.main_industry && (
                  <p>업태: {formData.main_industry}</p>
                )}
                {formData.main_sector && <p>종목: {formData.main_sector}</p>}
              </div>
            </div>
          )}

          {/* OCR 원본 텍스트 (디버그) */}
          {ocrRawText && (
            <details className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <summary className="text-xs font-medium text-slate-500 cursor-pointer">
                OCR 원본 텍스트 보기
              </summary>
              <pre className="mt-2 text-xs text-slate-600 whitespace-pre-wrap max-h-60 overflow-y-auto">
                {ocrRawText}
              </pre>
            </details>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-6 py-2.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              {ocrDone ? "다음: 추가 정보 입력" : "직접 입력하기"}
            </button>
          </div>
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
                  <span className="text-sm text-slate-700">남성</span>
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
                  <span className="text-sm text-slate-700">여성</span>
                </label>
              </div>
            </Field>
          </Section>

          <div className="flex gap-3 justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-6 py-2.5 text-sm text-slate-500 hover:text-slate-700"
            >
              이전
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !formData.company_name}
              className="px-8 py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg
                         hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
              <div className="flex items-center justify-between">
                <span>{result.error}</span>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="ml-3 px-4 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 shrink-0"
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

// ─── 스텝 인디케이터 ───

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { num: 1, label: "사업자등록증" },
    { num: 2, label: "정보 입력" },
    { num: 3, label: "추천 결과" },
  ];
  return (
    <div className="flex items-center justify-center gap-2 mb-10">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              s.num === current
                ? "bg-blue-600 text-white"
                : s.num < current
                  ? "bg-blue-100 text-blue-600"
                  : "bg-slate-100 text-slate-400"
            }`}
          >
            {s.num < current ? "\u2713" : s.num}
          </div>
          <span
            className={`text-sm hidden sm:inline ${
              s.num === current
                ? "text-slate-900 font-medium"
                : "text-slate-400"
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div className="w-8 h-px bg-slate-200 mx-1" />
          )}
        </div>
      ))}
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

  // 업로드 아이콘 (화살표)
  const UploadArrow = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );

  // 체크 아이콘
  const CheckIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );

  return (
    <div
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => !isPending && !done && fileRef.current?.click()}
      className={`relative rounded-2xl py-12 px-8 text-center transition-all duration-300 cursor-pointer select-none ${
        dragging
          ? "bg-[#fef5f3] border-2 border-dashed border-[#e8735a]"
          : done
            ? "bg-[#f0fdf4] border-2 border-[#86efac]"
            : "bg-white border-2 border-dashed border-slate-200 hover:border-[#e8735a]/40"
      }`}
    >
      {/* 원형 아이콘 */}
      <div className="flex justify-center mb-5">
        {isPending ? (
          <div className="w-16 h-16 rounded-full bg-[#e8735a] flex items-center justify-center">
            <div className="w-7 h-7 border-3 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        ) : done ? (
          <div className="w-16 h-16 rounded-full bg-[#22c55e] flex items-center justify-center text-white upload-check-pop">
            <CheckIcon />
          </div>
        ) : (
          <div
            className={`w-16 h-16 rounded-full bg-[#e8735a] flex items-center justify-center text-white ${
              dragging ? "upload-icon-dragging" : "upload-icon-idle"
            }`}
          >
            <UploadArrow />
          </div>
        )}
      </div>

      {/* 텍스트 영역 */}
      {dragging ? (
        <div className="pointer-events-none">
          <h3 className="text-xl font-bold text-slate-800 upload-fade-in">
            여기에 놓으세요
          </h3>
          <p className="text-sm text-slate-400 mt-2 upload-fade-in-delay">
            파일을 놓으면 바로 분석을 시작합니다
          </p>
        </div>
      ) : isPending ? (
        <div>
          <h3 className="text-xl font-bold text-slate-800">분석 중...</h3>
          <p className="text-sm text-slate-400 mt-2">
            사업자등록증에서 정보를 추출하고 있습니다
          </p>
        </div>
      ) : done ? (
        <div>
          <h3 className="text-xl font-bold text-slate-800 upload-fade-in">
            인식 완료
          </h3>
          <p className="text-sm text-slate-400 mt-2 upload-fade-in-delay">
            아래에서 추출된 정보를 확인하세요 /{" "}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileRef.current?.click();
              }}
              className="text-[#e8735a] hover:underline"
            >
              다시 업로드
            </button>
          </p>
        </div>
      ) : (
        <div>
          <h3 className="text-xl font-bold text-slate-800 tracking-tight">
            Drag <span className="font-light">&</span> drop
          </h3>
          <p className="text-sm text-slate-400 mt-2">
            JPG, PNG, WebP, PDF 형식 또는{" "}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileRef.current?.click();
              }}
              className="text-[#e8735a] hover:underline font-medium"
            >
              파일 선택
            </button>
          </p>
        </div>
      )}

      {/* 하단 안내 */}
      {!dragging && !isPending && !done && (
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 mt-8 max-w-md mx-auto text-left">
          {[
            "사업자등록증 이미지를 올려주세요",
            "기업 정보가 자동으로 입력됩니다",
            "OCR로 기업명, 소재지 등을 추출합니다",
            "추출 후 수동으로 수정할 수 있습니다",
          ].map((text, i) => (
            <div key={i} className="flex items-start gap-2">
              <span
                className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                  i === 0
                    ? "bg-[#e8735a]"
                    : "bg-slate-300"
                }`}
              />
              <span className="text-xs text-slate-400 leading-relaxed">
                {text}
              </span>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={handleChange}
        className="hidden"
      />
      {error && (
        <p className="mt-4 text-sm text-red-500 upload-fade-in">{error}</p>
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
    return diffMs > 24 * 60 * 60 * 1000; // 24시간 이상
  })();

  async function handleRefresh() {
    setRefreshPending(true);
    const res = await runRecommendation(formData, true);
    setRefreshPending(false);
    onRefreshComplete(res);
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

  // 지원분야 목록
  const fields = Array.from(
    new Set(
      result.matches
        .map((m) => m.announcement.supportField)
        .filter(Boolean)
    )
  );

  // 필터 적용
  let filtered = result.matches;
  if (filterField) {
    filtered = filtered.filter(
      (m) => m.announcement.supportField === filterField
    );
  }

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
              <span className={`text-xs ${isStale ? "text-amber-500 font-medium" : "text-slate-400"}`}>
                {cacheAgeText}
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

      {/* 필터/정렬 바 */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => onSortChange("score")}
            className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
              sortBy === "score"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500"
            }`}
          >
            적합도순
          </button>
          <button
            type="button"
            onClick={() => onSortChange("deadline")}
            className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
              sortBy === "deadline"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500"
            }`}
          >
            마감임박순
          </button>
        </div>
        {fields.length > 1 && (
          <select
            value={filterField}
            onChange={(e) => onFilterChange(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="">전체 분야</option>
            {fields.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        )}
        <span className="text-xs text-slate-400 ml-auto">
          {filtered.length}건 표시
        </span>
      </div>

      {/* 카드 리스트 */}
      <div className="space-y-3">
        {filtered.map((m) => (
          <MatchCard key={m.announcement.pbancSn || m.rank} match={m} />
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-8">
            조건에 맞는 공고가 없습니다
          </p>
        )}
      </div>

      {/* 크롤링 로딩 오버레이 */}
      {refreshPending && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-10 shadow-2xl text-center max-w-sm">
            <div className="w-14 h-14 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin mx-auto" />
            <p className="mt-5 text-base font-bold text-slate-800">
              최신 공고를 수집하고 있습니다
            </p>
            <p className="mt-2 text-sm text-slate-400">
              K-Startup, 기업마당에서 크롤링 중...
            </p>
            <p className="mt-1 text-xs text-slate-300">
              약 2분 정도 소요됩니다
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 개별 공고 카드 ───

function MatchCard({ match }: { match: MatchedAnnouncement }) {
  const a = match.announcement;
  const dday = getDday(a.receptionPeriod);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {a.supportField && (
              <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">
                {a.supportField}
              </span>
            )}
            {dday !== null && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  dday <= 3
                    ? "bg-red-100 text-red-700"
                    : dday <= 7
                      ? "bg-orange-100 text-orange-700"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                {dday === 0 ? "D-Day" : dday > 0 ? `D-${dday}` : `마감`}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-slate-900 leading-snug">
            {a.title}
          </h3>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
            {a.supervisionOrg && <span>주관: {a.supervisionOrg}</span>}
            {a.receptionPeriod && <span>접수: {a.receptionPeriod}</span>}
            {a.region && <span>지역: {a.region}</span>}
            {a.contact && <span>연락처: {a.contact}</span>}
          </div>
          {match.match_reasons.length > 0 && (
            <p className="mt-2 text-xs text-green-600">
              {match.match_reasons.join(" / ")}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="text-lg font-bold text-blue-600">
            {match.score.toFixed(0)}
            <span className="text-xs font-normal text-slate-400 ml-0.5">
              점
            </span>
          </div>
          {a.detailUrl && (
            <a
              href={a.detailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:underline"
            >
              상세보기 &rarr;
            </a>
          )}
        </div>
      </div>
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
    <fieldset className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
      <legend className="text-base font-semibold text-slate-900 px-1">
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
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
