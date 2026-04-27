import type { CompanyFormData } from "../../actions/recommend";
import { UploadSection } from "../upload/UploadSection";

export function Step1Upload({
  formData,
  ocrDone,
  ocrPending,
  ocrError,
  onOcr,
  onNext,
}: {
  formData: CompanyFormData;
  ocrDone: boolean;
  ocrPending: boolean;
  ocrError: string;
  onOcr: (file: File) => void;
  onNext: () => void;
}) {
  if (!ocrDone && !ocrPending) {
    return (
      <div className="grid grid-rows-[1fr_auto_1fr] gap-4">
        <UploadSection onFileSelect={onOcr} isPending={ocrPending} error={ocrError} done={ocrDone} />

        <div className="flex items-center gap-4 px-4">
          <div className="flex-1 h-px bg-[#e8e8e4]" />
          <span className="text-xs font-medium text-[#91959B]">또는</span>
          <div className="flex-1 h-px bg-[#e8e8e4]" />
        </div>

        <div
          onClick={onNext}
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
    );
  }

  return (
    <div className="space-y-4">
      <UploadSection onFileSelect={onOcr} isPending={ocrPending} error={ocrError} done={ocrDone} />

      {ocrDone && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-emerald-800 mb-2">추출된 정보</p>
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
            onClick={onNext}
            className="mt-3 w-full py-2.5 rounded-xl bg-[#131A1C] text-white text-sm font-semibold hover:bg-[#2a3035] transition-colors active:scale-[0.98]"
          >
            다음: 추가 정보 입력
          </button>
        </div>
      )}
    </div>
  );
}
