// Route loading skeleton mirroring the Clay page anatomy (docs/design/clay-layout.md).
// Server-safe on purpose: no hooks, no "use client", no imports from the client kit.

type PageSkeletonVariant = "list" | "detail" | "home" | "settings";

interface PageSkeletonProps {
  variant?: PageSkeletonVariant;
  metrics?: number;
  rows?: number;
}

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-active ${className}`} />;
}

function range(count: number) {
  return Array.from({ length: Math.max(0, count) }, (_, i) => i);
}

function HeaderRow() {
  return (
    <div className="flex items-center justify-between gap-4 px-8 pt-7 pb-6 max-sm:px-4">
      <div className="flex items-center gap-3">
        <Bar className="h-9 w-9 shrink-0 rounded-lg" />
        <Bar className="h-5 w-[160px]" />
      </div>
      <Bar className="h-8 w-[120px]" />
    </div>
  );
}

function MetricRow({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div className="flex flex-wrap gap-x-10 gap-y-4 px-8 pb-6 max-sm:px-4">
      {range(count).map((i) => (
        <div key={i} className="space-y-2">
          <Bar className="h-3 w-16" />
          <Bar className="h-5 w-12" />
        </div>
      ))}
    </div>
  );
}

function TableRows({ rows }: { rows: number }) {
  return (
    <div className="border-t border-divider">
      {range(rows).map((i) => (
        <div
          key={i}
          className="flex h-11 items-center gap-3 border-b border-divider px-8 max-sm:px-4"
        >
          <Bar className="h-4 w-4 shrink-0" />
          <Bar className="h-3 w-[30%]" />
          <Bar className="h-3 w-[15%]" />
          <Bar className="h-3 w-[15%]" />
          <Bar className="h-3 w-[10%]" />
        </div>
      ))}
    </div>
  );
}

function TableHeading() {
  return (
    <div className="flex h-14 items-center px-8 max-sm:px-4">
      <Bar className="h-5 w-[140px]" />
    </div>
  );
}

function ListSkeleton({ metrics, rows }: { metrics: number; rows: number }) {
  return (
    <div className="min-h-full pb-10">
      <HeaderRow />
      <MetricRow count={metrics} />
      <TableHeading />
      <TableRows rows={rows} />
    </div>
  );
}

function DetailSkeleton({ metrics, rows }: { metrics: number; rows: number }) {
  return (
    <div className="min-h-full pb-10">
      <div className="flex items-center gap-3 px-8 pt-7 pb-6 max-sm:px-4">
        <Bar className="h-12 w-12 shrink-0 rounded-full" />
        <div className="space-y-2">
          <Bar className="h-5 w-[200px]" />
          <Bar className="h-3 w-[280px] max-w-full" />
        </div>
      </div>
      <MetricRow count={metrics} />
      <div className="flex h-10 items-center gap-6 border-b border-divider px-8 max-sm:px-4">
        {range(4).map((i) => (
          <Bar key={i} className="h-3 w-16" />
        ))}
      </div>
      <div className="flex max-lg:flex-col">
        <div className="min-w-0 flex-1">
          <TableHeading />
          <TableRows rows={rows} />
        </div>
        <aside className="w-[320px] shrink-0 border-l border-divider max-lg:w-full max-lg:border-l-0 max-lg:border-t">
          {range(3).map((group) => (
            <div key={group} className="space-y-3 border-t border-divider px-6 py-5 first:border-t-0">
              <Bar className="h-3 w-24" />
              {range(3).map((row) => (
                <div key={row} className="grid grid-cols-[120px_1fr] gap-3">
                  <Bar className="h-3 w-16" />
                  <Bar className="h-3 w-3/4" />
                </div>
              ))}
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

function HomeSkeleton({ metrics, rows }: { metrics: number; rows: number }) {
  return (
    <div className="min-h-full pb-10">
      <div className="px-8 pt-7 max-sm:px-4">
        <Bar className="h-7 w-[220px]" />
        <Bar className="mt-5 h-12 w-[660px] max-w-full rounded-md" />
        <div className="mt-8 flex flex-wrap gap-4">
          {range(4).map((i) => (
            <Bar key={i} className="h-[84px] w-[230px] rounded-lg" />
          ))}
        </div>
      </div>
      <div className="mt-8">
        <MetricRow count={metrics} />
      </div>
      <TableHeading />
      <TableRows rows={rows} />
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="flex min-h-full">
      <div className="hidden w-[240px] shrink-0 space-y-4 border-r border-divider bg-subtle px-6 pt-6 lg:block">
        {range(8).map((i) => (
          <Bar key={i} className="h-3 w-3/4" />
        ))}
      </div>
      <div className="min-w-0 flex-1 px-12 pt-8 pb-10 max-sm:px-4">
        <Bar className="h-6 w-[180px]" />
        <div className="mt-8 max-w-[560px] space-y-6">
          {range(5).map((i) => (
            <div key={i} className="space-y-2">
              <Bar className="h-3 w-24" />
              <Bar className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PageSkeleton({ variant = "list", metrics = 4, rows = 8 }: PageSkeletonProps) {
  switch (variant) {
    case "detail":
      return <DetailSkeleton metrics={metrics} rows={rows} />;
    case "home":
      return <HomeSkeleton metrics={metrics} rows={rows} />;
    case "settings":
      return <SettingsSkeleton />;
    default:
      return <ListSkeleton metrics={metrics} rows={rows} />;
  }
}
