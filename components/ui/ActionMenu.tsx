"use client";

import { useState, useRef, useLayoutEffect, ReactNode, KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { DotsThreeIcon } from "@/components/ui/Icons";
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
  label?: string;
}

// Gap between the trigger and the menu, and the minimum distance kept from the viewport edge.
const MENU_GAP = 4;
const VIEWPORT_MARGIN = 8;

const menuItems = (menu: HTMLElement | null) =>
  Array.from(menu?.querySelectorAll<HTMLElement>("a, button") ?? []);

export function ActionMenu({ items, className, label = "More actions" }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // The menu is portalled to <body> with fixed positioning so table overflow cannot clip it.
  // Right-aligned to the trigger, below it; flips above when there is no room below.
  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const button = buttonRef.current;
      const menu = menuRef.current;
      if (!button || !menu) return;
      const rect = button.getBoundingClientRect();
      const menuHeight = menu.offsetHeight;
      const spaceBelow = window.innerHeight - rect.bottom;
      const flip = spaceBelow < menuHeight + MENU_GAP + VIEWPORT_MARGIN && rect.top > spaceBelow;
      menu.style.right = `${Math.max(window.innerWidth - rect.right, VIEWPORT_MARGIN)}px`;
      menu.style.top = flip ? "" : `${rect.bottom + MENU_GAP}px`;
      menu.style.bottom = flip ? `${window.innerHeight - rect.top + MENU_GAP}px` : "";
    };

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    // A fixed menu would drift away from its trigger (and over the top bar) on scroll, so close it instead.
    const handleScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };

    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };

    place();
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", place);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  // The portalled menu sits at the end of <body>, so bridge Tab order between trigger and items.
  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!open || e.key !== "Tab") return;
    if (e.shiftKey) {
      // Focus is leaving backwards, away from the menu.
      setOpen(false);
      return;
    }
    const first = menuItems(menuRef.current)[0];
    if (!first) return;
    e.preventDefault();
    first.focus();
  };

  const handleMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const focusable = menuItems(menuRef.current);
    if (e.shiftKey && document.activeElement === focusable[0]) {
      e.preventDefault();
      buttonRef.current?.focus();
    } else if (!e.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
      // Hand focus back to the trigger; the default Tab then continues to the next control after it.
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  const itemClassName = (variant?: "default" | "danger") =>
    cn(
      "flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-[14px] text-left transition-colors focus-visible:outline-none",
      variant === "danger"
        ? "text-danger hover:bg-subtle focus-visible:bg-subtle"
        : "text-fg hover:bg-subtle focus-visible:bg-subtle",
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
    <div ref={rootRef}>
      <button
        ref={buttonRef}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-md border border-line text-fg-secondary hover:bg-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          className,
        )}
      >
        <DotsThreeIcon size={14} className="text-current" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onKeyDown={handleMenuKeyDown}
            className="fixed min-w-45 rounded-lg border border-line bg-surface shadow-dropdown overflow-hidden z-50 p-1"
          >
            <div className="space-y-0.5">
              {items.map((item, index) =>
                item.href ? (
                  <Link
                    key={index}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className={itemClassName(item.variant)}
                  >
                    {itemContent(item)}
                  </Link>
                ) : (
                  <button
                    key={index}
                    role="menuitem"
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
          </div>,
          document.body,
        )}
    </div>
  );
}
