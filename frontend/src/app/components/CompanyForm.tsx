"use client";

import { useTransition, useEffect, useState } from "react";
import { runRecommendation, type RecommendResponse } from "../actions/recommend";
import { useCompanyForm } from "../hooks/useCompanyForm";
import { useOcr } from "../hooks/useOcr";
import { Step1Upload } from "./steps/Step1Upload";
import { Step2Form } from "./steps/Step2Form";
import { Step3Results } from "./steps/Step3Results";

const RESULT_STORAGE_KEY = "gov-funding-result";

function readStoredResult(): RecommendResponse | null {
  if (typeof window === "undefined") return null;

  const savedResult = localStorage.getItem(RESULT_STORAGE_KEY);
  if (!savedResult) return null;

  try {
    return JSON.parse(savedResult);
  } catch {
    return null;
  }
}

export function CompanyForm({
  step,
  onStepChange,
  activeView,
  onCompanyReady,
  onViewChange,
}: {
  step: 1 | 2 | 3;
  onStepChange: (s: 1 | 2 | 3) => void;
  activeView: "dashboard" | "announcements";
  onCompanyReady: (name: string) => void;
  onViewChange?: (view: "dashboard" | "announcements") => void;
}) {
  const { formData, updateField, patchFields, isHydrated, getSavedData } = useCompanyForm();
  const ocr = useOcr(patchFields);
  const [result, setResult] = useState<RecommendResponse | null>(readStoredResult);
  const [isPending, startTransition] = useTransition();

  // 저장된 정보가 있으면 자동으로 Step 3으로 이동
  useEffect(() => {
    if (isHydrated && step === 1) {
      const saved = getSavedData();
      if (saved && saved.company_name) {
        const savedResult = localStorage.getItem("gov-funding-result");
        if (savedResult) {
          if (result) {
            onStepChange(3);
            onCompanyReady(saved.company_name);
          } else {
            onStepChange(2);
          }
        } else {
          onStepChange(2);
        }
      }
    }
  }, [isHydrated, step, getSavedData, onStepChange, onCompanyReady, result]);

  function handleSubmit() {
    startTransition(async () => {
      const res = await runRecommendation(formData);
      setResult(res);
      if (res.success) {
        localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(res));
      }
      onStepChange(3);
      if (res.success) onCompanyReady(formData.company_name);
    });
  }

  const isWizardStep = step === 1 || step === 2;

  return (
    <div className={isWizardStep ? "max-w-2xl mx-auto px-6 py-10 space-y-6" : "space-y-0"}>
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
              activeView={activeView}
              onEditCondition={() => onStepChange(2)}
              onRefreshComplete={(res) => {
                setResult(res);
                if (res.success) {
                  localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(res));
                }
              }}
              onViewChange={onViewChange}
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
