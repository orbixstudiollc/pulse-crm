"use client";

import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg" | "xl";
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      leftIcon,
      rightIcon,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:shadow-focus disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 hover:bg-neutral-800 dark:hover:bg-neutral-100":
              variant === "primary",
            "bg-neutral-100 dark:bg-neutral-800 text-neutral-950 dark:text-neutral-50 hover:bg-neutral-200 dark:hover:bg-neutral-700":
              variant === "secondary",
            "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800":
              variant === "ghost",
            "border border-neutral-200 dark:border-neutral-800 bg-transparent text-neutral-950 dark:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-800":
              variant === "outline",
          },
          {
            "h-[34px] px-2.5 py-2 text-[13px] gap-2": size === "sm",
            "h-10 px-3 py-2.5 text-sm gap-2": size === "md",
            "h-11 px-3 py-3 text-sm gap-2": size === "lg",
            "h-12 px-3 py-3 text-base gap-2": size === "xl",
          },
          className,
        )}
        {...props}
      >
        {leftIcon}
        {children}
        {rightIcon}
      </button>
    );
  },
);

Button.displayName = "Button";
