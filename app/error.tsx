"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-danger bg-danger-surface">
          <svg
            className="h-5 w-5 text-danger"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>

        <h2 className="text-base font-semibold text-fg">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-fg-secondary">
          The page failed to load. Try again, or go back to the dashboard.
        </p>

        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={reset}
            className="inline-flex h-8 items-center rounded-md bg-inverse px-3 text-sm font-medium text-on-inverse transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/dashboard/overview"
            className="inline-flex h-8 items-center rounded-md border border-line px-3 text-sm font-medium text-fg transition-colors hover:bg-subtle"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
