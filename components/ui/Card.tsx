"use client";

import { cn } from "@/lib/utils";
import { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  border?: boolean;
  shadow?: "none" | "sm" | "md" | "lg";
}

export function Card({
  className,
  hover = false,
  border = true,
  shadow = "sm",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg bg-white dark:bg-neutral-900",
        border && "border border-neutral-200 dark:border-neutral-800",
        {
          "shadow-sm": shadow === "sm",
          "shadow-md": shadow === "md",
          "shadow-lg": shadow === "lg",
        },
        hover && "transition-shadow hover:shadow-md",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  action?: ReactNode;
}

export function CardHeader({
  className,
  title,
  description,
  action,
  children,
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 px-6 py-4 border-b border-neutral-200 dark:border-neutral-800",
        className,
      )}
      {...props}
    >
      <div className="space-y-1 min-w-0 flex-1">
        {title && (
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {title}
          </h3>
        )}
        {description && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {description}
          </p>
        )}
        {children}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean;
}

export function CardBody({
  className,
  noPadding = false,
  children,
  ...props
}: CardBodyProps) {
  return (
    <div
      className={cn(!noPadding && "px-6 py-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}

type CardFooterProps = HTMLAttributes<HTMLDivElement>;

export function CardFooter({
  className,
  children,
  ...props
}: CardFooterProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-6 py-4 border-t border-neutral-200 dark:border-neutral-800",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
