import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  children?: ReactNode;
}

export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-3xl font-serif text-neutral-950 dark:text-neutral-50">
        {title}
      </h1>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}
