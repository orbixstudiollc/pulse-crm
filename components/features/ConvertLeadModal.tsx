"use client";

import { useState } from "react";
import {
  Modal,
  Button,
  UsersThreeIcon,
  CircleNotchIcon,
} from "@/components/ui";
import { X } from "@phosphor-icons/react";

interface ConvertLeadModalProps {
  open: boolean;
  onClose: () => void;
  onConvert: () => void;
  leadName: string;
}

export function ConvertLeadModal({
  open,
  onClose,
  onConvert,
  leadName,
}: ConvertLeadModalProps) {
  const [isConverting, setIsConverting] = useState(false);

  const handleConvert = () => {
    setIsConverting(true);
    setTimeout(() => {
      setIsConverting(false);
      onConvert();
    }, 1500);
  };

  return (
    <Modal open={open} onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-neutral-800">
        <h2 className="text-xl font-serif text-neutral-950 dark:text-neutral-50">
          Convert to Customer
        </h2>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="p-5">
        <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
          You&apos;re about to convert {leadName} from a lead to a customer.
          This will move them to your Customers list and allow you to manage
          their account.
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 p-5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleConvert}
          disabled={isConverting}
          leftIcon={
            isConverting ? (
              <CircleNotchIcon size={18} className="animate-spin" />
            ) : (
              <UsersThreeIcon size={18} />
            )
          }
        >
          {isConverting ? "Converting..." : "Convert to Customer"}
        </Button>
      </div>
    </Modal>
  );
}
