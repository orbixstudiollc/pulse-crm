import Link from "next/link";

export default function DealNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16">
      <div className="mx-auto max-w-md text-center">
        <p className="text-2xl font-semibold text-fg-disabled">
          404
        </p>
        <h2 className="mt-2 text-xl font-semibold text-fg">
          Deal not found
        </h2>
        <p className="mt-2 text-sm text-fg-secondary">
          The deal you are looking for does not exist or has been removed.
        </p>
        <Link
          href="/dashboard/sales"
          className="mt-6 inline-flex h-8 items-center rounded-md bg-inverse px-3 text-sm font-medium text-on-inverse transition-opacity hover:opacity-90"
        >
          Go to Sales Pipeline
        </Link>
      </div>
    </div>
  );
}
