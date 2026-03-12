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
      <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-neutral-800">
        <h2 className="text-xl font-serif text-neutral-950 dark:text-neutral-50">
          Mark Deal as Won
        </h2>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="p-5 space-y-5">
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
      <div className="flex items-center justify-end gap-3 p-5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleConfirm}>Confirm Won</Button>
      </div>
    </Modal>
  );
}
