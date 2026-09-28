"use client";

import { useState, useRef, ReactNode } from "react";
import Link from "next/link";
import { DotsThreeVerticalIcon } from "@/components/ui/Icons";
import { useClickOutside } from "@/hooks";
import { cn } from "@/lib/utils";

interface ActionMenuItem {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "danger";
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  className?: string;
}

export function ActionMenu({ items, className }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<"bottom" | "top">("bottom");
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useClickOutside(menuRef, () => setOpen(false), open);

  const handleOpen = () => {
    if (buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - buttonRect.bottom;
      setPosition(spaceBelow < 200 ? "top" : "bottom");
    }
    setOpen(true);
  };

  const itemClassName = (variant?: "default" | "danger") =>
    cn(
      "flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm text-left transition-colors focus-visible:outline-none",
      variant === "danger"
        ? "text-danger hover:bg-danger-surface focus-visible:bg-danger-surface"
        : "text-fg hover:bg-muted focus-visible:bg-muted",
    );

  const itemContent = (item: ActionMenuItem) => (
    <>
      {item.icon && (
        <span
          className={cn(
            item.variant === "danger"
              ? "text-danger"
              : "text-fg-muted",
          )}
        >
          {item.icon}
        </span>
      )}
      {item.label}
    </>
  );

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={buttonRef}
        onClick={() => (open ? setOpen(false) : handleOpen())}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-sm text-fg-secondary hover:bg-muted hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          className,
        )}
      >
        <DotsThreeVerticalIcon size={16} className="text-current" />
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 min-w-45 rounded-lg border border-line bg-surface shadow-dropdown overflow-hidden z-50 p-1",
            position === "bottom" ? "top-full mt-1" : "bottom-full mb-1",
          )}
        >
          <div className="space-y-0.5">
            {items.map((item, index) =>
              item.href ? (
                <Link
                  key={index}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={itemClassName(item.variant)}
                >
                  {itemContent(item)}
                </Link>
              ) : (
                <button
                  key={index}
                  onClick={() => {
                    item.onClick?.();
                    setOpen(false);
                  }}
                  className={itemClassName(item.variant)}
                >
                  {itemContent(item)}
                </button>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
