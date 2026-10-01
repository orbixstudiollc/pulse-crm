"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  position?: "center" | "top";
  className?: string;
  role?: "dialog" | "alertdialog";
  "aria-labelledby"?: string;
  "aria-label"?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

// Open panels, innermost last. Only the top one traps Tab.
const openPanels: HTMLElement[] = [];

function focusableIn(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0,
  );
}

export function Modal({
  open,
  onClose,
  children,
  position = "center",
  className,
  role = "dialog",
  "aria-labelledby": ariaLabelledBy,
  "aria-label": ariaLabel,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // Move focus in on open, trap Tab while open, restore focus on close.
  // A layout effect, so the opener is captured before children's passive effects run.
  // React applies a child's autoFocus before this runs, so content marks its
  // initial focus target with data-autofocus instead.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;

    const previous = document.activeElement as HTMLElement | null;
    openPanels.push(panel);
    // Keep focus a child already took.
    if (!panel.contains(document.activeElement)) {
      (panel.querySelector<HTMLElement>("[data-autofocus]") ?? focusableIn(panel)[0] ?? panel).focus();
    }

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || e.defaultPrevented || openPanels[openPanels.length - 1] !== panel) return;
      // A portalled menu (e.g. ActionMenu) sits outside the panel and handles Tab itself.
      if (document.activeElement?.closest('[role="menu"]')) return;
      const items = focusableIn(panel);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!panel.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleTab);

    return () => {
      document.removeEventListener("keydown", handleTab);
      openPanels.splice(openPanels.indexOf(panel), 1);
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className={cn(
            "fixed inset-0 z-50 flex justify-center px-4 bg-black/40",
            position === "center" && "items-center",
            position === "top" && "items-start pt-[20vh]",
          )}
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            role={role}
            aria-modal="true"
            aria-labelledby={ariaLabelledBy}
            aria-label={ariaLabel}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            data-clay-box className={cn("w-full max-w-[480px] overflow-hidden rounded-xl border border-line bg-surface shadow-modal focus:outline-none", className)}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
