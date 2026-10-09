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
    <div className="space-y-6 sm:space-y-8" aria-busy="true" aria-label="Loading">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <Block className="h-8 w-40 sm:h-10 sm:w-56" />
          <Block className="h-4 w-full max-w-80" />
        </div>
        <Block className="h-11 w-11 shrink-0 rounded-full sm:w-36" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="surface space-y-3 px-4 py-4 sm:space-y-4 sm:px-6 sm:py-5">
            <Block className="h-9 w-9 rounded-xl sm:h-10 sm:w-10" />
            <Block className="h-3 w-24" />
            <Block className="h-8 w-16" />
          </div>
        ))}
      </div>

      <div className="surface space-y-4 p-4 sm:p-6">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 sm:gap-4">
            <Block className="h-10 w-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Block className="h-4 w-1/3" />
              <Block className="h-3 w-1/4" />
            </div>
            <Block className="hidden h-6 w-20 rounded-full sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
