import type { CompanyFormData } from "../../actions/recommend";
import { Section } from "../ui/Section";
import { Field } from "../ui/Field";

export function Step2Form({
  formData,
  isPending,
  onUpdateField,
  onBack,
  onSubmit,
}: {
  formData: CompanyFormData;
  isPending: boolean;
  onUpdateField: (field: keyof CompanyFormData, value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-6">
      <Section title="기업 기본 정보">
        <p className="text-sm text-[#676C73]">
          OCR로 채워진 항목을 확인하고, 추천 정확도를 높일 정보만 보완해 주세요.
        </p>
        <Field label="기업명" required>
          <input
            type="text"
            name="company_name"
            autoComplete="organization"
            required
            value={formData.company_name}
            onChange={(e) => onUpdateField("company_name", e.target.value)}
            placeholder="예: CV기획"
            className="input"
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="설립연월일">
            <input
              type="date"
              name="established_date"
              value={formData.established_date}
              onChange={(e) => onUpdateField("established_date", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="소재지">
            <input
              type="text"
              name="address"
              autoComplete="street-address"
              value={formData.address}
              onChange={(e) => onUpdateField("address", e.target.value)}
              placeholder="서울특별시 강남구 테헤란로 123"
              className="input"
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="주업종">
            <input
              type="text"
              name="main_industry"
              value={formData.main_industry}
              onChange={(e) => onUpdateField("main_industry", e.target.value)}
              placeholder="예: 정보통신업"
              className="input"
            />
          </Field>
          <Field label="주요산업">
            <input
              type="text"
              name="main_sector"
              value={formData.main_sector}
              onChange={(e) => onUpdateField("main_sector", e.target.value)}
              placeholder="예: AI/빅데이터"
              className="input"
            />
          </Field>
        </div>
        <Field label="사업아이템 한줄 정리">
          <textarea
            rows={2}
            name="business_item_summary"
            value={formData.business_item_summary}
            onChange={(e) => onUpdateField("business_item_summary", e.target.value)}
            placeholder="예: AI 기반 영상 콘텐츠 자동 제작 솔루션"
            className="input resize-none"
          />
        </Field>
      </Section>

      <Section title="대표자 정보">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="대표자명">
            <input
              type="text"
              name="ceo_name"
              autoComplete="name"
              value={formData.ceo_name}
              onChange={(e) => onUpdateField("ceo_name", e.target.value)}
              placeholder="홍길동"
              className="input"
            />
          </Field>
          <Field label="대표자 생년월일">
            <input
              type="date"
              name="ceo_birth_date"
              autoComplete="bday"
              value={formData.ceo_birth_date}
              onChange={(e) => onUpdateField("ceo_birth_date", e.target.value)}
              className="input"
            />
          </Field>
        </div>
        <Field label="대표자 성별">
          <div className="flex gap-4 mt-1" role="radiogroup" aria-label="대표자 성별">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="ceo_gender"
                value="M"
                checked={formData.ceo_gender === "M"}
                onChange={() => onUpdateField("ceo_gender", "M")}
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
                onChange={() => onUpdateField("ceo_gender", "F")}
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
          onClick={onBack}
          className="px-8 py-3 bg-yellow-500 text-white text-sm font-semibold rounded-lg
                     hover:bg-[#2a3035] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          이전
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isPending || !formData.company_name}
          className="px-8 py-3 bg-[#131A1C] text-white text-sm font-semibold rounded-lg
                     hover:bg-[#2a3035] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {isPending ? "매칭 분석 중..." : "맞춤 추천 받기"}
        </button>
      </div>
    </div>
  );
}
