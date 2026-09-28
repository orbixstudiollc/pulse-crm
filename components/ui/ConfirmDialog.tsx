"use client";

import { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { WarningIcon, XIcon } from "./Icons";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  loading?: boolean;
  icon?: ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  icon,
}: ConfirmDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && !loading) {
      onClose();
    }
    if (e.key === "Enter" && !loading) {
      handleConfirm();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40"
          onClick={!loading ? onClose : undefined}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-description"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-[480px] overflow-hidden rounded-lg border border-line bg-surface shadow-modal"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            {/* Header */}
            <div className="flex items-start gap-3 px-4 pt-4 pb-2">
              {/* Icon */}
              <div
                className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                  variant === "danger"
                    ? "bg-danger-surface text-danger"
                    : "bg-accent-surface text-accent-on-surface"
                )}
              >
                {icon || <WarningIcon className="h-4 w-4" />}
              </div>

              {/* Title and Close */}
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-start justify-between gap-2">
                  <h2
                    id="confirm-dialog-title"
                    className="text-heading-md text-fg"
                  >
                    {title}
                  </h2>
                  {!loading && (
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-shrink-0 -mt-1 -mr-1 flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary hover:text-fg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      aria-label="Close dialog"
                    >
                      <XIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Message */}
            <div className="pr-4 pb-4 pl-15">
              <p
                id="confirm-dialog-description"
                className="text-sm text-fg-secondary leading-relaxed"
              >
                {message}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-divider">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={loading}
              >
                {cancelLabel}
              </Button>
              <Button
                type="button"
                variant={variant === "danger" ? "danger" : "primary"}
                onClick={handleConfirm}
                loading={loading}
              >
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
