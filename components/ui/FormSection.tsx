import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function FormSection({
  title,
  description,
  children,
}: FormSectionProps) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-4">
        <h3 className="text-heading-md text-fg">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-fg-secondary mt-0.5">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

interface FormRowProps {
  label: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function FormRow({
  label,
  description,
  children,
  className,
}: FormRowProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-6 py-3 border-b border-divider last:border-b-0",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-fg">{label}</div>
        {description && (
          <p className="mt-0.5 text-[13px] text-fg-secondary">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
