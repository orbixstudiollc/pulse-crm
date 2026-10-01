"use client";

import { useId } from "react";
import { Button, Modal, TrashIcon, CircleNotchIcon } from "@/components/ui";

interface DeleteConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  itemName?: string;
  loading?: boolean;
}

export function DeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  title = "Delete Customer",
  description,
  itemName,
  loading = false,
}: DeleteConfirmModalProps) {
  const titleId = useId();
  const defaultDescription = itemName
    ? `Are you sure you want to delete ${itemName}? This action cannot be undone and will permanently remove all associated data.`
    : "Are you sure you want to delete this item? This action cannot be undone and will permanently remove all associated data.";

  return (
    <Modal open={open} onClose={onClose} role="alertdialog" aria-labelledby={titleId}>
      <div className="p-4 text-center sm:text-left">
        {/* Icon */}
        <div className="mx-auto sm:mx-0 w-8 h-8 rounded-full bg-danger-surface flex items-center justify-center mb-3">
          <TrashIcon size={16} className="text-danger" />
        </div>

        {/* Title */}
        <h3 id={titleId} className="text-heading-md text-fg mb-1">
          {title}
        </h3>

        {/* Description */}
        <p className="text-[14px] leading-5 text-fg-secondary">
          {description || defaultDescription}
        </p>

        {/* Actions */}
        <div className="-mx-4 -mb-4 mt-4 flex justify-end gap-2 px-4 py-3 border-t border-divider">
          <Button
            variant="outline"
            className="shrink-0"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            className="shrink-0"
            onClick={onConfirm}
            disabled={loading}
            leftIcon={
              loading ? (
                <CircleNotchIcon size={18} className="animate-spin" />
              ) : undefined
            }
          >
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
