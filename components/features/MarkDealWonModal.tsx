"use client";

import { useState } from "react";
import { Modal, Button, Input, Textarea } from "@/components/ui";
import { X } from "@phosphor-icons/react";

interface MarkDealWonModalProps {
  open: boolean;
  onClose: () => void;
  dealValue: number;
  onConfirm: (data: {
    finalValue: string;
    closeDate: string;
    notes: string;
  }) => void;
}

export function MarkDealWonModal({
  open,
  onClose,
  dealValue,
  onConfirm,
}: MarkDealWonModalProps) {
  const [finalValue, setFinalValue] = useState(
    `$${dealValue.toLocaleString()}`,
  );
  const [closeDate, setCloseDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [notes, setNotes] = useState("");

  const handleConfirm = () => {
    onConfirm({ finalValue, closeDate, notes });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      {/* Header */}
      <div className="flex h-12 items-center justify-between px-4 border-b border-divider">
        <h2 className="text-heading-md text-fg">
          Mark Deal as Won
        </h2>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary hover:bg-muted hover:text-fg transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Final Deal Value */}
        <Input
          label="Final Deal Value"
          value={finalValue}
          onChange={(e) => setFinalValue(e.target.value)}
          placeholder="$0"
        />

        {/* Close Date */}
        <Input
          label="Close Date"
          type="date"
          value={closeDate}
          onChange={(e) => setCloseDate(e.target.value)}
        />

        {/* Notes */}
        <Textarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any notes about this win..."
          rows={4}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-divider bg-subtle">
        <Button variant="ghost" className="shrink-0" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleConfirm}>Confirm Won</Button>
      </div>
    </Modal>
  );
}
