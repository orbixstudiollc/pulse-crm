export default function CalendarLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header Skeleton */}
      <div className="mb-6">
        <div className="h-8 w-48 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-4" />
        <div className="flex gap-2">
          <div className="h-10 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
          <div className="h-10 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
        </div>
      </div>

      {/* Navigation Skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
          <div className="h-10 w-40 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
          <div className="h-10 w-10 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
          <div className="h-10 w-20 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
        </div>
        <div className="h-10 w-48 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
      </div>

      {/* Calendar Grid Skeleton */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-neutral-200 dark:border-neutral-800">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-12 border-r border-neutral-200 dark:border-neutral-800 last:border-r-0 bg-neutral-50 dark:bg-neutral-900"
            />
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }).map((_, i) => (
            <div
              key={i}
              className="h-32 border-r border-b border-neutral-200 dark:border-neutral-800 p-3"
            >
              <div className="h-7 w-7 bg-neutral-200 dark:bg-neutral-800 rounded-full animate-pulse mb-2" />
              <div className="space-y-1.5">
                <div className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
