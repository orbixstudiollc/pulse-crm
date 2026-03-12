import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  children?: ReactNode;
}

export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <h1 className="text-[28px] leading-[36px] tracking-[-0.56px] font-serif text-neutral-950 dark:text-neutral-50">
        {title}
      </h1>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}
