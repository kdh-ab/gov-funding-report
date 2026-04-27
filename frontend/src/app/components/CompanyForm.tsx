"use client";

import { useTransition } from "react";
import { runRecommendation, type RecommendResponse } from "../actions/recommend";
import { useCompanyForm } from "../hooks/useCompanyForm";
import { useOcr } from "../hooks/useOcr";
import { Step1Upload } from "./steps/Step1Upload";
import { Step2Form } from "./steps/Step2Form";
import { Step3Results } from "./steps/Step3Results";
import { useState } from "react";

export function CompanyForm({
  step,
  onStepChange,
}: {
  step: 1 | 2 | 3;
  onStepChange: (s: 1 | 2 | 3) => void;
}) {
  const { formData, updateField, patchFields } = useCompanyForm();
  const ocr = useOcr(patchFields);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const res = await runRecommendation(formData);
      setResult(res);
      onStepChange(3);
    });
  }

  return (
    <div className="space-y-6">
      {step === 1 && (
        <Step1Upload
          formData={formData}
          ocrDone={ocr.done}
          ocrPending={ocr.pending}
          ocrError={ocr.error}
          onOcr={ocr.handleOcr}
          onNext={() => onStepChange(2)}
        />
      )}

      {step === 2 && (
        <Step2Form
          formData={formData}
          isPending={isPending}
          onUpdateField={updateField}
          onBack={() => onStepChange(1)}
          onSubmit={handleSubmit}
        />
      )}

      {step === 3 && result && (
        <div className="space-y-6">
          {result.success ? (
            <Step3Results
              result={result}
              formData={formData}
              onEditCondition={() => onStepChange(2)}
              onRefreshComplete={(res) => setResult(res)}
            />
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
              <div className="flex items-center justify-between">
                <span>{result.error}</span>
                <button
                  type="button"
                  onClick={() => onStepChange(2)}
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
