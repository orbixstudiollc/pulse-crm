"use client";

import { forwardRef, SelectHTMLAttributes } from "react";
import { CaretDownIcon } from "@/components/ui";
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
        <div className="relative">
          <select
            ref={ref}
            id={id}
            className={cn(
              "w-full appearance-none rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2.5 pr-9 text-sm text-neutral-950 dark:text-neutral-50 transition-shadow cursor-pointer focus:outline-none focus:border-neutral-200 dark:focus:border-neutral-700 focus:shadow-focus",
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
          <CaretDownIcon
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none"
          />
        </div>
      </div>
    );
  },
);

Select.displayName = "Select";
