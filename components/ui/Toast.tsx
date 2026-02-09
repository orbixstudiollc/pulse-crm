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
        <div className="fixed bottom-6 left-4 right-4 sm:left-auto z-50">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg",
            "bg-neutral-900 dark:bg-neutral-50 text-white dark:text-neutral-900",
          )}
        >
          {variant === "success" ? (
            <CheckCircleIcon
              size={20}
              weight="fill"
              className="text-green-400 dark:text-green-600"
            />
          ) : (
            <WarningIcon
              size={20}
              weight="fill"
              className="text-red-400 dark:text-red-600"
            />
          )}
          <span className="text-sm font-medium flex-1">{message}</span>
          <button
            onClick={onClose}
            className="ml-2 shrink-0 text-neutral-400 hover:text-white dark:text-neutral-500 dark:hover:text-neutral-900 transition-colors"
          >
            <XIcon size={16} />
          </button>
        </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
