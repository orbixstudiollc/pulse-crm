import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 min-h-8 max-sm:flex-col max-sm:items-start">
      <div>
        <h1 className="text-[22px] leading-7 font-semibold text-fg">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-[13px] text-fg-muted">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
