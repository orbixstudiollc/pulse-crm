function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800 ${className ?? ""}`}
    />
  );
}

export default function SettingsLoading() {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Page header */}
      <Skeleton className="h-8 w-32" />

      {/* Tabs */}
      <div className="flex gap-4 border-b border-neutral-200 pb-2 dark:border-neutral-800">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-md" />
        ))}
      </div>

      {/* Form fields */}
      <div className="max-w-2xl space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ))}

        {/* Save button */}
        <Skeleton className="h-10 w-28 rounded-md" />
      </div>
    </div>
  );
}
