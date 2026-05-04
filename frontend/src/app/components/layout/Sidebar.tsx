"use client";

import Image from "next/image";

export type ActiveView = "dashboard" | "announcements";

interface SidebarProps {
  step: number;
  activeView: ActiveView | null;
  companyName: string;
  onNavigate: (view: ActiveView) => void;
  onEditCompany: () => void;
  onReset: () => void;
}

export function Sidebar({
  step,
  activeView,
  companyName,
  onNavigate,
  onEditCompany,
  onReset,
}: SidebarProps) {
  const isSetupDone = step === 3;

  const navItems: { id: ActiveView; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "대시보드", icon: <IconDashboard /> },
    { id: "announcements", label: "공고 리스트", icon: <IconList /> },
  ];

  return (
    <aside className="hidden md:flex w-[220px] h-full bg-white border-r border-slate-200 flex-col shrink-0 select-none">
      {/* 브랜드 */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <Image src="/logo-ab.png" alt="Alpha Brothers" width={96} height={28} className="h-7 w-auto" />
          <div>
            <p className="text-[11px] font-bold text-slate-800 leading-tight">정부지원사업</p>
            <p className="text-[10px] text-slate-400 leading-tight mt-0.5">맞춤 추천 시스템</p>
          </div>
        </div>
      </div>

      {/* 메인 메뉴 */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold text-slate-400 px-3 pb-1.5 pt-1 tracking-widest uppercase">
          메뉴
        </p>

        {navItems.map((item) => {
          const isActive = isSetupDone && activeView === item.id;
          const isDisabled = !isSetupDone;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => !isDisabled && onNavigate(item.id)}
              disabled={isDisabled}
              className={[
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-left transition-colors",
                isActive
                  ? "bg-slate-100 text-slate-900 font-medium"
                  : isDisabled
                  ? "text-slate-300 cursor-not-allowed"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
              ].join(" ")}
            >
              <span className={isActive ? "text-slate-700" : isDisabled ? "text-slate-300" : "text-slate-400"}>
                {item.icon}
              </span>
              {item.label}
              {item.id === "dashboard" && !isSetupDone && (
                <span className="ml-auto text-[10px] text-slate-300">설정 필요</span>
              )}
            </button>
          );
        })}

        {/* 설정 섹션 */}
        <div className="pt-3 mt-2">
          <p className="text-[10px] font-semibold text-slate-400 px-3 pb-1.5 tracking-widest uppercase">
            설정
          </p>
          <button
            type="button"
            onClick={onEditCompany}
            className={[
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-left transition-colors",
              step === 1 || step === 2
                ? "bg-slate-100 text-slate-900 font-medium"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
            ].join(" ")}
          >
            <span className={step === 1 || step === 2 ? "text-slate-700" : "text-slate-400"}>
              <IconBuilding />
            </span>
            기업 정보
          </button>
        </div>
      </nav>

      {/* 하단: 기업명 + 리셋 */}
      <div className="px-4 py-4 border-t border-slate-100">
        {companyName ? (
          <div className="mb-3">
            <p className="text-[10px] text-slate-400 mb-0.5">분석 대상</p>
            <p className="text-[12px] font-semibold text-slate-700 truncate">{companyName}</p>
          </div>
        ) : (
          <div className="mb-3">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              기업 정보를 입력하면
              <br />추천 결과를 볼 수 있습니다
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
        >
          <IconReset />
          처음부터 시작
        </button>
      </div>
    </aside>
  );
}

// ─── 아이콘 ────────────────────────────────────────────────────────────────────

function IconDashboard() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" fill="currentColor" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" fill="currentColor" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" fill="currentColor" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1.2" fill="currentColor" />
    </svg>
  );
}

function IconList() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="2.5" cy="4.5" r="1.2" fill="currentColor" />
      <line x1="5.5" y1="4.5" x2="14" y2="4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="2.5" cy="8" r="1.2" fill="currentColor" />
      <line x1="5.5" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="2.5" cy="11.5" r="1.2" fill="currentColor" />
      <line x1="5.5" y1="11.5" x2="14" y2="11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M2 14V6.5L8 2.5L14 6.5V14" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <rect x="6" y="9.5" width="4" height="4.5" rx="0.5" fill="currentColor" opacity="0.7" />
      <rect x="3" y="8" width="2.5" height="2.5" rx="0.4" stroke="currentColor" strokeWidth="1.2" />
      <rect x="10.5" y="8" width="2.5" height="2.5" rx="0.4" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function IconReset() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M1.5 6a4.5 4.5 0 1 1 1.3 3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M1.5 9.5V6H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
