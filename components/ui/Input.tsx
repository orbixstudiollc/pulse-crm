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
            className="block text-sm font-medium text-fg"
          >
            {label}
            {required && <span className="text-danger ml-0.5">*</span>}
            {optional && (
              <span className="text-fg-muted font-normal ml-1">
                (optional)
              </span>
            )}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted">
              {leftIcon}
            </span>
          )}
          {prefix && !leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-secondary">
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
              "h-8 w-full rounded-md border bg-surface px-3 text-[14px] text-fg placeholder:text-fg-muted transition-colors duration-150 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50",
              error
                ? "border-danger"
                : "border-line",
              (leftIcon || prefix) && "pl-9",
              rightIcon && "pr-9",
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
            className="text-xs text-danger"
          >
            {error}
          </p>
        )}
        {!error && helperText && (
          <p
            id={`${id}-helper`}
            className="text-xs text-fg-secondary"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
