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
            className={cn(
              "w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm text-neutral-950 dark:text-neutral-50 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 transition-shadow focus:outline-none focus:border-neutral-200 dark:focus:border-neutral-700 focus:shadow-focus",
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
      </div>
    );
  },
);

Input.displayName = "Input";
