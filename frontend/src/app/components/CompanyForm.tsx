"use client";

import { useState, useTransition, useRef } from "react";
import {
  extractFromBusinessLicense,
  type OcrResponse,
} from "../actions/ocr";
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
  const [sortBy, setSortBy] = useState<"score" | "deadline">("score");
  const [filterField, setFilterField] = useState("");

  function updateField(field: keyof CompanyFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  // OCR 처리
  async function handleOcr(file: File) {
    setOcrPending(true);
    setOcrError("");
    const fd = new FormData();
    fd.append("file", file);
    const res: OcrResponse = await extractFromBusinessLicense(fd);
    setOcrPending(false);

    if (!res.success) {
      setOcrError(res.error);
      return;
    }

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
      <StepIndicator current={step} />

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
            />
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
              {result.error}
            </div>
          )}
          <div className="flex gap-3 justify-start">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-6 py-2.5 text-sm text-slate-500 hover:text-slate-700"
            >
              조건 수정하기
            </button>
          </div>
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
    <div className="flex items-center justify-center gap-2 mb-2">
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

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  }

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
        done
          ? "border-green-300 bg-green-50"
          : "border-slate-300 bg-white hover:border-blue-400"
      }`}
    >
      {isPending ? (
        <div className="space-y-3">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-600">
            사업자등록증 분석 중...
          </p>
        </div>
      ) : done ? (
        <div className="space-y-2">
          <p className="text-lg text-green-700 font-medium">
            사업자등록증 인식 완료
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-sm text-green-600 underline"
          >
            다른 파일로 다시 시도
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-4xl text-slate-300">&#128196;</div>
          <p className="text-sm text-slate-600">
            사업자등록증 이미지를 업로드하면
            <br />
            기업 정보가 자동으로 입력됩니다
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg
                       hover:bg-blue-700 transition-colors"
          >
            파일 선택
          </button>
          <p className="text-xs text-slate-400">JPG, PNG, WebP 지원</p>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        className="hidden"
      />
      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
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
}: {
  result: Extract<RecommendResponse, { success: true }>;
  sortBy: "score" | "deadline";
  onSortChange: (v: "score" | "deadline") => void;
  filterField: string;
  onFilterChange: (v: string) => void;
}) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const crawledDate = result.crawled_at
    ? new Date(result.crawled_at).toLocaleDateString("ko-KR")
    : "";

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
          {crawledDate && (
            <span className="text-xs text-slate-400">
              데이터 기준: {crawledDate}
            </span>
          )}
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
