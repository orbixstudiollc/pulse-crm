function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-neutral-200 dark:bg-neutral-800 ${className ?? ""}`}
    />
  );
}

export default function CalendarLoading() {
  return (
    <div className="space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      {/* Page header */}
      <Skeleton className="h-8 w-36" />

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9 rounded" />
          <Skeleton className="h-9 w-9 rounded" />
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-6" />
        ))}
      </div>

      {/* Calendar grid (5 weeks) */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    </div>
  );
}
