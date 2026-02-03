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
      "flex w-full items-center gap-3 px-3 py-2.5 text-sm text-left rounded-lg transition-colors",
      variant === "danger"
        ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
        : "text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800",
    );

  const itemContent = (item: ActionMenuItem) => (
    <>
      {item.icon && (
        <span
          className={cn(
            item.variant === "danger"
              ? "text-red-600 dark:text-red-400"
              : "text-neutral-400 dark:text-neutral-500",
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
          "flex h-8 w-8 items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
          className,
        )}
      >
        <DotsThreeVerticalIcon size={20} className="text-neutral-500" />
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 min-w-45 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg overflow-hidden z-50 p-2",
            position === "bottom" ? "top-full mt-1" : "bottom-full mb-1",
          )}
        >
          <div className="space-y-1">
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
