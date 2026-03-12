function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-neutral-200 dark:bg-neutral-800 ${className ?? ""}`}
    />
  );
}

export default function ActivityLoading() {
  return (
    <div className="space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      {/* Page header */}
      <Skeleton className="h-8 w-36" />

      {/* Filter bar */}
      <Skeleton className="h-10 w-48 rounded" />

      {/* Activity feed items */}
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
