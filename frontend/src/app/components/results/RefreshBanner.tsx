export function RefreshBanner({
  progressMessages,
}: {
  progressMessages: { step: string; message: string }[];
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <div
        className="bg-white/95 backdrop-blur border-t border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] px-6 py-4 max-w-2xl mx-auto rounded-t-2xl"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin shrink-0" />
          <p className="text-sm font-semibold text-slate-800">최신 공고를 수집하고 있습니다</p>
        </div>
        <div className="space-y-1.5 pl-8">
          {progressMessages.map((msg, i) => {
            const isLatest = i === progressMessages.length - 1;
            const isDone = msg.step.endsWith("_done");
            const isError = msg.step.endsWith("_error");
            return (
              <div
                key={i}
                className={`flex items-center gap-2 text-xs transition-opacity ${
                  isLatest ? "opacity-100" : "opacity-50"
                }`}
              >
                {isDone ? (
                  <span className="text-green-500 text-sm">&#10003;</span>
                ) : isError ? (
                  <span className="text-red-400 text-sm">&#10007;</span>
                ) : isLatest ? (
                  <span className="w-3 h-3 border border-blue-300 border-t-blue-600 rounded-full animate-spin shrink-0" />
                ) : (
                  <span className="text-green-500 text-sm">&#10003;</span>
                )}
                <span
                  className={
                    isDone
                      ? "text-green-700"
                      : isError
                        ? "text-red-600"
                        : isLatest
                          ? "text-slate-700"
                          : "text-slate-500"
                  }
                >
                  {msg.message}
                </span>
              </div>
            );
          })}
          {progressMessages.length === 0 && (
            <p className="text-xs text-slate-400">연결 중...</p>
          )}
        </div>
      </div>
    </div>
  );
}
