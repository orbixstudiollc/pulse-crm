function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-neutral-200 dark:bg-neutral-800 ${className ?? ""}`}
    />
  );
}

export default function OverviewLoading() {
  return (
    <div className="space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      {/* Page header */}
      <Skeleton className="h-8 w-64" />

      {/* Stat cards row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>

      {/* Leads & Activity row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 lg:col-span-2" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
