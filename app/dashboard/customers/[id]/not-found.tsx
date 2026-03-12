import Link from "next/link";

export default function CustomerNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16">
      <div className="mx-auto max-w-md text-center">
        <p className="text-4xl font-semibold text-neutral-300 dark:text-neutral-700">
          404
        </p>
        <h2 className="mt-2 font-serif text-xl font-semibold text-neutral-950 dark:text-neutral-50">
          Customer not found
        </h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          The customer you are looking for does not exist or has been removed.
        </p>
        <Link
          href="/dashboard/customers"
          className="mt-6 inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Go to Customers
        </Link>
      </div>
    </div>
  );
}
