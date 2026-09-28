"use client";

import { forwardRef, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  required?: boolean;
  optional?: boolean;
  prefix?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      required,
      optional,
      prefix,
      leftIcon,
      rightIcon,
      error,
      helperText,
      className,
      id,
      ...props
    },
    ref,
  ) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-neutral-950 dark:text-neutral-50"
          >
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
            {optional && (
              <span className="text-neutral-400 dark:text-neutral-500 font-normal ml-1">
                (optional)
              </span>
            )}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500">
              {leftIcon}
            </span>
          )}
          {prefix && !leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500 dark:text-neutral-400">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={
              error ? `${id}-error` : helperText ? `${id}-helper` : undefined
            }
            className={cn(
              "w-full rounded-lg border bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm text-neutral-950 dark:text-neutral-50 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
              error
                ? "border-red-300 dark:border-red-700"
                : "border-neutral-200 dark:border-neutral-800",
              (leftIcon || prefix) && "pl-10",
              rightIcon && "pr-10",
              className,
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
              {rightIcon}
            </span>
          )}
        </div>
        {error && (
          <p
            id={`${id}-error`}
            className="text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}
        {!error && helperText && (
          <p
            id={`${id}-helper`}
            className="text-sm text-neutral-500 dark:text-neutral-400"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
