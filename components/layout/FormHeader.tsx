"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { CaretLeftIcon } from "@/components/ui/Icons";

interface FormHeaderProps {
  backHref: string;
  breadcrumb: [string, string]; // [parent, current]
  children: ReactNode; // Action buttons
}

export function FormHeader({
  backHref,
  breadcrumb,
  children,
}: FormHeaderProps) {
  return (
    <header className="flex h-20 items-center justify-between border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-8">
      <div className="flex items-center gap-3">
        <Link
          href={backHref}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <CaretLeftIcon size={20} className="text-neutral-500" />
        </Link>
        <nav className="flex items-center gap-2 text-xs">
          <Link
            href={backHref}
            className="text-neutral-500 uppercase hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors"
          >
            {breadcrumb[0]}
          </Link>
          <span className="text-neutral-500">/</span>
          <span className="font-medium text-neutral-950 dark:text-neutral-50 uppercase">
            {breadcrumb[1]}
          </span>
        </nav>
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </header>
  );
}
