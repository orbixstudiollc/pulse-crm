function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800 ${className ?? ""}`}
    />
  );
}

export default function SalesLoading() {
  return (
    <div className="space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>

      {/* Pipeline columns */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, col) => (
          <div key={col} className="space-y-3">
            <Skeleton className="h-8 w-full rounded-md" />
            {Array.from({ length: 3 }).map((_, card) => (
              <Skeleton key={card} className="h-28" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
