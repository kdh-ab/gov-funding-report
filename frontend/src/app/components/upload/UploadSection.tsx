"use client";

import { useState, useRef } from "react";

function FileIcons() {
  return (
    <div className="relative w-24 h-20 mx-auto">
      <svg className="absolute left-0 top-2 upload-file-icon" width="30" height="38" viewBox="0 0 30 38" fill="none" stroke="#131A1C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="1" width="24" height="32" rx="3" fill="white" />
        <circle cx="13" cy="17" r="6" />
        <polygon points="11,14 11,20 16,17" fill="#131A1C" stroke="none" />
      </svg>
      <svg className="absolute left-7 top-0 z-10 upload-file-icon-center" width="34" height="42" viewBox="0 0 34 42" fill="none" stroke="#131A1C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="1" width="28" height="36" rx="3" fill="white" />
        <path d="M8 8h4v4H8z" fill="#131A1C" stroke="none" rx="0.5" />
        <polyline points="1,30 10,22 16,28 22,20 29,28" strokeWidth="1.5" />
      </svg>
      <svg className="absolute right-0 top-2 upload-file-icon" width="30" height="38" viewBox="0 0 30 38" fill="none" stroke="#131A1C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 1H5a4 4 0 00-4 4v24a4 4 0 004 4h16a4 4 0 004-4V7l-6-6z" fill="white" />
        <path d="M19 1v6h6" />
        <circle cx="11" cy="22" r="3" />
        <path d="M14 22V12l6-2" />
      </svg>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function UploadSection({
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

  return (
    <div className="upload-outer-card rounded-2xl p-5 select-none flex-1 flex flex-col">
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

        {dragging ? (
          <div className="pointer-events-none">
            <h3 className="text-xl font-bold text-[#131A1C] upload-fade-in">여기에 놓으세요</h3>
            <p className="text-sm text-[#91959B] mt-2 upload-fade-in-delay">파일을 놓으면 바로 분석을 시작합니다</p>
          </div>
        ) : isPending ? (
          <div>
            <h3 className="text-xl font-bold text-[#131A1C]">분석 중...</h3>
            <p className="text-sm text-[#91959B] mt-2">사업자등록증에서 정보를 추출하고 있습니다</p>
          </div>
        ) : done ? (
          <div>
            <h3 className="text-xl font-bold text-[#131A1C] upload-fade-in">인식 완료</h3>
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
              Drag & drop <span className="text-[#131A1C]">사업자등록증</span>
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
