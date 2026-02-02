"use client";

import { forwardRef, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  required?: boolean;
  options: { label: string; value: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, required, options, placeholder, className, id, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-neutral-950 dark:text-neutral-50"
          >
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={cn(
            "w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm text-neutral-950 dark:text-neutral-50 transition-shadow cursor-pointer focus:outline-none focus:border-neutral-200 dark:focus:border-neutral-700 focus:shadow-[0_0_0_2px_#ffffff,0_0_0_4px_#0a0a0a] dark:focus:shadow-[0_0_0_2px_#171717,0_0_0_4px_#fafafa]",
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" className="text-neutral-400">
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  },
);

Select.displayName = "Select";
