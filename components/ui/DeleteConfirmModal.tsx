"use client";

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
  const defaultDescription = itemName
    ? `Are you sure you want to delete ${itemName}? This action cannot be undone and will permanently remove all associated data.`
    : "Are you sure you want to delete this item? This action cannot be undone and will permanently remove all associated data.";

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6 text-center sm:text-left">
        {/* Icon */}
        <div className="mx-auto sm:mx-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center mb-4">
          <TrashIcon size={24} className="text-red-500 dark:text-red-400" />
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50 mb-2">
          {title}
        </h3>

        {/* Description */}
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
          {description || defaultDescription}
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-red-500 dark:bg-red-600 border-red-500 dark:border-red-600 text-white! hover:bg-red-600 dark:hover:bg-red-700 hover:border-red-600 dark:hover:border-red-700"
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
