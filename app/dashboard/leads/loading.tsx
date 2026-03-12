function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-neutral-200 dark:bg-neutral-800 ${className ?? ""}`}
    />
  );
}

export default function LeadsLoading() {
  return (
    <div className="space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-32 rounded" />
      </div>

      {/* Search bar */}
      <Skeleton className="h-10 w-full max-w-sm rounded" />

      {/* Table skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-10 w-full rounded" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
