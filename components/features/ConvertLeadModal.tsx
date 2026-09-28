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
      <div className="flex h-12 items-center justify-between px-4 border-b border-divider">
        <h2 className="text-heading-md text-fg">
          Convert to Customer
        </h2>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary hover:bg-muted hover:text-fg transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="p-4">
        <p className="text-sm text-fg-secondary leading-relaxed">
          You&apos;re about to convert {leadName} from a lead to a customer.
          This will move them to your Customers list and allow you to manage
          their account.
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-divider bg-subtle">
        <Button variant="ghost" className="shrink-0" onClick={onClose}>
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
