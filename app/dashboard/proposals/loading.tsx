function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-active ${className ?? ""}`}
    />
  );
}

export default function ProposalsLoading() {
  return (
    <div className="space-y-4 px-4 py-6 sm:px-6 lg:px-6">
      {/* Page header */}
      <Skeleton className="h-8 w-48" />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>

      {/* Table rows */}
      <div className="space-y-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
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
