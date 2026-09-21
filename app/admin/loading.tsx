export default function AdminLoading() {
  return <div aria-busy="true" aria-live="polite" className="animate-pulse motion-reduce:animate-none">
    <div className="flex items-start justify-between gap-4">
      <div><div className="h-9 w-44 rounded-lg bg-white/[0.11]" /><div className="mt-3 h-4 w-96 max-w-[70vw] rounded bg-white/[0.07]" /></div>
      <div className="h-8 w-28 rounded-lg bg-white/[0.06]" />
    </div>
    <div className="mt-6 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-[142px] rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)]" />)}
    </div>
    <div className="mt-3 grid gap-2.5 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-[108px] rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)]" />)}
    </div>
    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <div className="h-[360px] rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)]" />
      <div className="h-[360px] rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)]" />
    </div>
  </div>;
}
