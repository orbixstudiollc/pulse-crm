"use client";

import { useEffect, useRef } from "react";
import { WarningIcon, XIcon } from "@/components/ui";

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title = "Confirm",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmColors =
    variant === "danger"
      ? "bg-danger text-on-inverse hover:opacity-90"
      : variant === "warning"
        ? "bg-warning text-on-inverse hover:opacity-90"
        : "bg-accent-strong text-on-inverse hover:bg-accent-strong/90";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-sm mx-4 bg-surface rounded-lg border border-line shadow-modal overflow-hidden animate-in fade-in duration-200">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center ${
                variant === "danger"
                  ? "bg-danger-surface"
                  : variant === "warning"
                    ? "bg-warning-surface"
                    : "bg-muted"
              }`}
            >
              <WarningIcon
                size={16}
                className={
                  variant === "danger"
                    ? "text-danger"
                    : variant === "warning"
                      ? "text-warning"
                      : "text-fg-secondary"
                }
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-heading-md text-fg">{title}</h3>
              <p className="mt-1 text-sm text-fg-secondary">{message}</p>
            </div>
            <button
              onClick={onCancel}
              className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-md text-fg-secondary hover:bg-muted hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <XIcon size={16} />
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-divider">
          <button
            onClick={onCancel}
            className="h-8 px-3 text-sm font-medium rounded-md text-fg-secondary hover:bg-muted hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`h-8 px-3 text-sm font-medium rounded-md transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${confirmColors}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
