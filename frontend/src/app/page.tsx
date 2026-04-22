import { CompanyForm } from "./components/CompanyForm";

export default function Home() {
  return (
    <main className="flex-1">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-5">
          <h1 className="text-xl font-bold text-slate-900">
            정부지원사업 맞춤 추천
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            사업자등록증을 업로드하면 기업에 맞는 지원사업을 찾아드립니다
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <CompanyForm />
      </div>
    </main>
  );
}
