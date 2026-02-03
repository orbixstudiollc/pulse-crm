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
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
      <div className="mb-5">
        <h3 className="text-lg font-serif text-neutral-950 dark:text-neutral-50">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
