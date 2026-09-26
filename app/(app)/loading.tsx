/**
 * Shown the instant you click a link, while the server builds the page.
 * Without it the old page just sits there frozen until the new one arrives,
 * which reads as "the app is slow" even when the wait is short. Next.js also
 * prefetches this for every visible link, so it appears with no delay at all.
 */
function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-stone-200/70 ${className}`} />;
}

export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-3">
          <Block className="h-10 w-56" />
          <Block className="h-4 w-80" />
        </div>
        <Block className="h-11 w-36 rounded-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="surface space-y-4 px-6 py-5">
            <Block className="h-10 w-10 rounded-xl" />
            <Block className="h-3 w-24" />
            <Block className="h-8 w-16" />
          </div>
        ))}
      </div>

      <div className="surface space-y-4 p-6">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <Block className="h-10 w-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Block className="h-4 w-1/3" />
              <Block className="h-3 w-1/4" />
            </div>
            <Block className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
