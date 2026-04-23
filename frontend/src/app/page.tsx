"use client";

import { useState } from "react";
import { CompanyForm } from "./components/CompanyForm";

export default function Home() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const pct = Math.round((step / 3) * 100);

  return (
    <main className="flex-1">
      <header className="sticky top-0 z-40 bg-white border-b border-[#e8e8e4]">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-2.5">
          <img src="/logo-ab.png" alt="Alpha Brothers" className="h-8 w-auto" />
          <span className="text-sm font-bold text-[#131A1C] tracking-tight">
            정부지원사업 맞춤 추천
          </span>
        </div>
        <div className="w-full h-1.5 bg-[#e8e8e4]">
          <div
            className="h-full bg-yellow-300 transition-all duration-500 ease-out rounded-r-full"
            style={{ width: `${pct}%` }}
          />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <CompanyForm step={step} onStepChange={setStep} />
      </div>
    </main>
  );
}
