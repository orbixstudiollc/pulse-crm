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
          {/* The label's ::after gives a 32px hit area (an ::after on the <input> is unreliable
              outside Chromium). A click on that area stops here: the label then clicks the input,
              and that click alone reaches a clickable parent, so a parent that also toggles
              (a <button> row) sees one click, not two. */}
          <label
            className="relative flex items-center cursor-pointer has-disabled:cursor-not-allowed after:absolute after:-inset-2 after:content-['']"
            onClick={(e) => {
              if (e.target === e.currentTarget) e.stopPropagation();
            }}
          >
            <input
              ref={ref}
              type="checkbox"
              id={id}
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? `${id}-error` : undefined}
              className={cn(
                "peer relative h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-sm border border-line bg-surface transition-colors duration-150 focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50",
                "checked:bg-accent checked:border-accent",
                className,
              )}
              {...props}
            />
            <svg
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100"
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
          </label>
          {(label || description) && (
            <div className="flex-1 space-y-0.5">
              {label && (
                <label
                  htmlFor={id}
                  className="text-sm font-medium text-fg cursor-pointer"
                >
                  {label}
                </label>
              )}
              {description && (
                <p className="text-[13px] text-fg-muted">
                  {description}
                </p>
              )}
            </div>
          )}
        </div>
        {error && (
          <p
            id={`${id}-error`}
            className="text-xs text-danger ml-7"
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);

Checkbox.displayName = "Checkbox";
