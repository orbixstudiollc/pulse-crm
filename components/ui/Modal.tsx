"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  position?: "center" | "top";
  className?: string;
}

export function Modal({
  open,
  onClose,
  children,
  position = "center",
  className,
}: ModalProps) {
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

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex justify-center bg-black/40 dark:bg-black/60",
        position === "center" && "items-center",
        position === "top" && "items-start pt-[20vh]",
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full max-w-lg overflow-hidden rounded-2xl border border-white dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
