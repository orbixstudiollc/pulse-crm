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
              "peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-full border border-line bg-surface transition-colors duration-150 focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50",
              "checked:bg-accent checked:border-accent",
              className,
            )}
            {...props}
          />
          <span className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current text-white opacity-0 peer-checked:opacity-100" />
        </div>
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
