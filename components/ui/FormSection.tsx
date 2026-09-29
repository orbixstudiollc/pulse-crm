import { ReactNode } from "react";

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
