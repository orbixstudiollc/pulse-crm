"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircleIcon, WarningIcon, XIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

interface ToastProps {
  open: boolean;
  onClose: () => void;
  message: string;
  variant?: "success" | "error";
  duration?: number;
}

export function Toast({
  open,
  onClose,
  message,
  variant = "success",
  duration = 4000,
}: ToastProps) {
  useEffect(() => {
    if (open && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [open, duration, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-max max-w-[calc(100vw-2rem)]">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn(
            "flex items-center gap-2 rounded-full border bg-inverse text-on-inverse px-4 py-2 text-sm shadow-dropdown",
            variant === "success" ? "border-success" : "border-danger",
          )}
        >
          {variant === "success" ? (
            <CheckCircleIcon
              size={16}
              weight="fill"
              className="shrink-0"
            />
          ) : (
            <WarningIcon
              size={16}
              weight="fill"
              className="shrink-0"
            />
          )}
          <span className="font-medium flex-1">{message}</span>
          <button
            onClick={onClose}
            className="ml-1 shrink-0 rounded-full text-on-inverse/70 hover:text-on-inverse transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <XIcon size={16} />
          </button>
        </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
