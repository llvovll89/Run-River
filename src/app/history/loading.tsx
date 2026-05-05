export default function HistoryLoading() {
  return (
    <main className="min-h-dvh" style={{ background: "var(--c-bg)" }}>
      <div
        className="px-5"
        style={{
          paddingTop: "calc(var(--sat) + 10px)",
          paddingBottom: "16px",
          background: "var(--c-surface)",
          borderBottom: "1px solid var(--c-border)",
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl" style={{ background: "var(--c-elevated)" }} />
        </div>
        <div className="h-7 w-28 rounded-xl mb-2" style={{ background: "var(--c-elevated)" }} />
        <div className="h-4 w-16 rounded-lg" style={{ background: "var(--c-elevated)" }} />
      </div>

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
    </main>
  );
}
