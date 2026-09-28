"use client";

import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  description?: string;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, error, className, id, ...props }, ref) => {
    return (
      <div className="space-y-1">
        <div className="flex items-start gap-3">
          <div className="relative flex items-center">
            <input
              ref={ref}
              type="checkbox"
              id={id}
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? `${id}-error` : undefined}
              className={cn(
                "peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                "checked:bg-indigo-600 checked:border-indigo-600",
                className,
              )}
              {...props}
            />
            <svg
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 text-white opacity-0 peer-checked:opacity-100"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          {(label || description) && (
            <div className="flex-1 space-y-0.5">
              {label && (
                <label
                  htmlFor={id}
                  className="text-sm font-medium text-neutral-900 dark:text-neutral-100 cursor-pointer"
                >
                  {label}
                </label>
              )}
              {description && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {description}
                </p>
              )}
            </div>
          )}
        </div>
        {error && (
          <p
            id={`${id}-error`}
            className="text-sm text-red-600 dark:text-red-400 ml-7"
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);

Checkbox.displayName = "Checkbox";
