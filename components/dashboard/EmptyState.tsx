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
      {/* Icon */}
      <div className="mb-3 flex text-fg-muted [&_svg]:size-6">
        {icon}
      </div>

      {/* Title */}
      <h3 className="text-[13px] font-medium text-fg">
        {title}
      </h3>

      {/* Description */}
      <p className="mt-1 text-[13px] text-fg-muted max-w-xs">
        {description}
      </p>

      {/* Actions */}
      {actions.length > 0 && (
        <div className="mt-4 flex items-center gap-2">
          {actions.map((action, index) => {
            // Actions are secondary (outlined) unless the caller sets a variant.
            const variant = action.variant ?? "outline";
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
