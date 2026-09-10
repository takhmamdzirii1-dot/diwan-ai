export default function AdminLoading() {
  return <div aria-busy="true" aria-live="polite" className="animate-pulse motion-reduce:animate-none">
    <div className="h-8 w-52 rounded-lg bg-white/[0.07]" />
    <div className="mt-3 h-4 w-full max-w-xl rounded bg-white/[0.04]" />
    <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-28 rounded-2xl border border-white/[0.05] bg-white/[0.025]" />)}
    </div>
    <div className="mt-5 h-72 rounded-2xl border border-white/[0.05] bg-white/[0.02]" />
  </div>;
}
