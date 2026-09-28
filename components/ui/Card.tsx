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
  // Accepted for API compatibility; flat surfaces render no shadow at any value.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  shadow: _shadow = "sm",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg bg-surface",
        border && "border border-line",
        hover && "transition-colors hover:border-fg-muted",
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
        "flex items-start justify-between gap-4 px-4 py-3 border-b border-divider",
        className,
      )}
      {...props}
    >
      <div className="space-y-1 min-w-0 flex-1">
        {title && (
          <h3 className="text-heading-md text-fg">
            {title}
          </h3>
        )}
        {description && (
          <p className="text-sm text-fg-secondary">
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
      className={cn(!noPadding && "p-4", className)}
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
        "flex items-center gap-3 px-4 py-3 border-t border-divider",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
