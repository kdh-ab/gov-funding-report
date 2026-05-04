"use client";

import { useState } from "react";
import { CompanyForm } from "./components/CompanyForm";
import { Sidebar, type ActiveView } from "./components/layout/Sidebar";

export default function Home() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [activeView, setActiveView] = useState<ActiveView>("dashboard");
  const [companyName, setCompanyName] = useState("");

  function handleStepChange(s: 1 | 2 | 3) {
    setStep(s);
    if (s === 3) setActiveView("dashboard");
  }

  function handleReset() {
    setStep(1);
    setActiveView("dashboard");
    setCompanyName("");
    localStorage.removeItem("gov-funding-company-form");
    localStorage.removeItem("gov-funding-result");
  }

  return (
    <div className="flex min-h-screen flex-col md:h-full md:flex-row md:overflow-hidden">
      <Sidebar
        step={step}
        activeView={step === 3 ? activeView : null}
        companyName={companyName}
        onNavigate={(view) => setActiveView(view)}
        onEditCompany={() => handleStepChange(2)}
        onReset={handleReset}
      />

      <main className="flex-1 min-h-0 overflow-y-auto bg-[#F4F4F1]">
        <MobileHeader
          step={step}
          activeView={activeView}
          companyName={companyName}
          onNavigate={setActiveView}
          onEditCompany={() => handleStepChange(2)}
          onReset={handleReset}
        />
        <CompanyForm
          step={step}
          onStepChange={handleStepChange}
          activeView={activeView}
          onCompanyReady={setCompanyName}
          onViewChange={setActiveView}
        />
      </main>
    </div>
  );
}

function MobileHeader({
  step,
  activeView,
  companyName,
  onNavigate,
  onEditCompany,
  onReset,
}: {
  step: 1 | 2 | 3;
  activeView: ActiveView;
  companyName: string;
  onNavigate: (view: ActiveView) => void;
  onEditCompany: () => void;
  onReset: () => void;
}) {
  return (
    <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-500">
            {step === 3 ? "추천 결과" : `STEP ${step} / 3`}
          </p>
          <p className="truncate text-sm font-semibold text-slate-900">
            {companyName || "정부지원사업 맞춤 추천"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {step === 3 && (
            <button
              type="button"
              onClick={onEditCompany}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              조건 수정
            </button>
          )}
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
          >
            초기화
          </button>
        </div>
      </div>
      {step === 3 && (
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => onNavigate("dashboard")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeView === "dashboard"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500"
            }`}
          >
            대시보드
          </button>
          <button
            type="button"
            onClick={() => onNavigate("announcements")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeView === "announcements"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500"
            }`}
          >
            공고 리스트
          </button>
        </div>
      )}
    </div>
  );
}
