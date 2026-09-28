"use client";

import { forwardRef, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  helperText?: string;
  autoResize?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      required,
      optional,
      error,
      helperText,
      autoResize = false,
      className,
      id,
      onChange,
      ...props
    },
    ref,
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (autoResize) {
        e.target.style.height = "auto";
        e.target.style.height = `${e.target.scrollHeight}px`;
      }
      onChange?.(e);
    };

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
        <textarea
          ref={ref}
          id={id}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={
            error ? `${id}-error` : helperText ? `${id}-helper` : undefined
          }
          onChange={handleChange}
          className={cn(
            "w-full rounded-md border bg-surface px-3 py-1.5 text-sm text-fg placeholder:text-fg-muted transition-colors duration-150 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50 resize-none",
            error
              ? "border-danger"
              : "border-line",
            !autoResize && "resize-y",
            className,
          )}
          {...props}
        />
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

Textarea.displayName = "Textarea";
