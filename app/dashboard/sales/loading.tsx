function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-active ${className ?? ""}`}
    />
  );
}

export default function SalesLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-32 rounded" />
      </div>

      {/* Pipeline columns */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, col) => (
          <div key={col} className="space-y-3">
            <Skeleton className="h-8 w-full rounded" />
            {Array.from({ length: 3 }).map((_, card) => (
              <Skeleton key={card} className="h-28" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
