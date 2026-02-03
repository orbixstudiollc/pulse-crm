"use client";

import { cn } from "@/lib/utils";

interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

interface RadioGroupProps {
  name: string;
  label?: string;
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function RadioGroup({
  name,
  label,
  options,
  value,
  onChange,
  className,
}: RadioGroupProps) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-2">
          {label}
        </label>
      )}
      <div className="flex gap-3">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "relative flex-1 flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors",
              value === option.value
                ? "border-neutral-950 dark:border-neutral-50 bg-neutral-50 dark:bg-neutral-800"
                : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={(e) => onChange(e.target.value)}
              className="sr-only"
            />
            <div
              className={cn(
                "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                value === option.value
                  ? "border-neutral-950 dark:border-neutral-50"
                  : "border-neutral-300 dark:border-neutral-600",
              )}
            >
              {value === option.value && (
                <div className="w-2 h-2 rounded-full bg-neutral-950 dark:bg-neutral-50" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                {option.label}
              </p>
              {option.description && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {option.description}
                </p>
              )}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
