export default function CalendarLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-6">
      {/* Header Skeleton */}
      <div className="mb-6">
        <div className="h-8 w-48 bg-muted rounded-md animate-pulse mb-4" />
        <div className="flex gap-2">
          <div className="h-8 w-32 bg-muted rounded-md animate-pulse" />
          <div className="h-8 w-32 bg-muted rounded-md animate-pulse" />
        </div>
      </div>

      {/* Navigation Skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-muted rounded-md animate-pulse" />
          <div className="h-8 w-40 bg-muted rounded-md animate-pulse" />
          <div className="h-8 w-8 bg-muted rounded-md animate-pulse" />
          <div className="h-8 w-20 bg-muted rounded-md animate-pulse" />
        </div>
        <div className="h-8 w-48 bg-muted rounded-md animate-pulse" />
      </div>

      {/* Calendar Grid Skeleton */}
      <div className="rounded-lg border border-line bg-surface overflow-hidden">
        <div className="grid grid-cols-7 border-b border-divider">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-9 border-r border-divider last:border-r-0 bg-muted"
            />
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }).map((_, i) => (
            <div
              key={i}
              className="h-32 border-r border-b border-row p-2"
            >
              <div className="h-7 w-7 bg-muted rounded-full animate-pulse mb-2" />
              <div className="space-y-1.5">
                <div className="h-8 bg-muted rounded-md animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
