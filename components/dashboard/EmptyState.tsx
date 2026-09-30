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
      className={cn("py-12 flex flex-col items-center text-center", className)}
    >
      {/* Icon Container */}
      <div className="h-10 w-10 rounded-lg bg-subtle text-fg-muted flex items-center justify-center mb-4">
        {icon}
      </div>

      {/* Title */}
      <h3 className="text-[16px] leading-6 font-semibold text-fg mb-1">
        {title}
      </h3>

      {/* Description */}
      <p className="text-[13px] text-fg-muted max-w-xs mb-4">
        {description}
      </p>

      {/* Actions */}
      {actions.length > 0 && (
        <div className="flex items-center gap-2">
          {actions.map((action, index) => {
            // First action is the primary CTA unless the caller says otherwise.
            const variant = action.variant ?? (index === 0 ? "primary" : "outline");
            if (action.href) {
              return (
                <a key={index} href={action.href}>
                  <Button variant={variant} leftIcon={action.icon}>
                    {action.label}
                  </Button>
                </a>
              );
            }

            return (
              <Button
                key={index}
                variant={variant}
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
