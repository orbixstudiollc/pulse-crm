import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({ title, description, icon, children }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-8 pt-7 pb-6 max-sm:flex-col max-sm:items-start max-sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-subtle text-fg-secondary [&_svg]:size-[18px]">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-[20px] leading-7 font-semibold text-fg">
            {title}
          </h1>
          {description && (
            <div className="text-[13px] text-fg-muted">{description}</div>
          )}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
