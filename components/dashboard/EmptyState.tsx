import { ReactNode } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "outline";
  icon?: ReactNode;
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  actions?: EmptyStateAction[];
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actions = [],
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn("py-16 flex flex-col items-center text-center", className)}
    >
      {/* Icon Container */}
      <div className="w-12 h-12 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center mb-5">
        <div className="text-neutral-950 dark:text-neutral-50">{icon}</div>
      </div>

      {/* Title */}
      <h3 className="text-2xl font-serif text-neutral-950 dark:text-neutral-50 mb-2">
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-xs mb-6">
        {description}
      </p>

      {/* Actions */}
      {actions.length > 0 && (
        <div className="flex items-center gap-3">
          {actions.map((action, index) => {
            const buttonVariant =
              action.variant === "outline" ? "outline" : "primary";

            if (action.href) {
              return (
                <a key={index} href={action.href}>
                  <Button variant={buttonVariant} leftIcon={action.icon}>
                    {action.label}
                  </Button>
                </a>
              );
            }

            return (
              <Button
                key={index}
                variant={buttonVariant}
                leftIcon={action.icon}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
