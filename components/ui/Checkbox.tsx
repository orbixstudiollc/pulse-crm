"use client";

import { forwardRef, InputHTMLAttributes } from "react";
import { CheckIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className, checked, ...props }, ref) => {
    return (
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <div className="relative">
          <input
            ref={ref}
            type="checkbox"
            checked={checked}
            className="peer sr-only"
            {...props}
          />
          <div
            className={cn(
              "flex h-[18px] w-[18px] items-center justify-center rounded border-[1.5px] transition-all",
              "border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-950",
              "peer-checked:border-neutral-950 peer-checked:bg-neutral-950 dark:peer-checked:border-neutral-50 dark:peer-checked:bg-neutral-50",
              "peer-focus-visible:shadow-focus",
              className,
            )}
          >
            <CheckIcon
              size={12}
              weight="bold"
              className={cn(
                "text-white dark:text-neutral-950 transition-opacity",
                checked ? "opacity-100" : "opacity-0",
              )}
            />
          </div>
        </div>
        {label && (
          <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            {label}
          </span>
        )}
      </label>
    );
  },
);

Checkbox.displayName = "Checkbox";
