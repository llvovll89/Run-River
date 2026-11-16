import AppNavigation from "@/components/AppNavigation";
import ScreenHeader from "@/components/ScreenHeader";

export default function HistoryLoading() {
  return (
    <main className="app-screen min-h-dvh" style={{ background: "var(--c-bg)" }}>
      <ScreenHeader title="활동 기록" />
      <p role="status" className="px-5 pt-4 text-sm" style={{color: "var(--c-text-2)"}}>기록을 불러오는 중…</p>
      <div className="px-4 pt-4">
        <div className="card rounded-2xl p-4">
          <div className="h-3 w-16 rounded mb-3" style={{ background: "var(--c-elevated)" }} />
          <div className="grid grid-cols-3 gap-0">
            {[0, 1, 2].map((i) => (
              <div key={i} className="text-center">
                <div className="h-8 w-14 rounded-lg mx-auto mb-1" style={{ background: "var(--c-elevated)" }} />
                <div className="h-3 w-10 rounded mx-auto" style={{ background: "var(--c-elevated)" }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 pb-8 space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-4 w-5 rounded" style={{ background: "var(--c-elevated)" }} />
                <div>
                  <div className="h-4 w-24 rounded mb-1" style={{ background: "var(--c-elevated)" }} />
                  <div className="h-3 w-14 rounded" style={{ background: "var(--c-elevated)" }} />
                </div>
              </div>
              <div className="h-6 w-12 rounded-full" style={{ background: "var(--c-elevated)" }} />
            </div>
            <div className="grid grid-cols-3 pt-3" style={{ borderTop: "1px solid var(--c-border)" }}>
              {[0, 1, 2].map((j) => (
                <div key={j} className="text-center">
                  <div className="h-3 w-10 rounded mx-auto mb-1" style={{ background: "var(--c-elevated)" }} />
                  <div className="h-5 w-16 rounded mx-auto" style={{ background: "var(--c-elevated)" }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <AppNavigation />
    </main>
  );
}
