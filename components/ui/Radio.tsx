"use client";

import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  description?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ label, description, className, id, ...props }, ref) => {
    return (
      <div className="flex items-start gap-3">
        <div className="relative flex items-center">
          <input
            ref={ref}
            type="radio"
            id={id}
            className={cn(
              "peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              "checked:border-indigo-600 checked:border-[5px]",
              className,
            )}
            {...props}
          />
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
    );
  },
);

Radio.displayName = "Radio";

interface RadioGroupProps {
  children: React.ReactNode;
  className?: string;
  orientation?: "vertical" | "horizontal";
}

export function RadioGroup({
  children,
  className,
  orientation = "vertical",
}: RadioGroupProps) {
  return (
    <div
      role="radiogroup"
      className={cn(
        "space-y-3",
        orientation === "horizontal" && "flex items-center gap-6 space-y-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
