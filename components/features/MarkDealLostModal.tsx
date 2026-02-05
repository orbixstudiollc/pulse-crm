"use client";

import { useState } from "react";
import { Modal, Button, Input, Textarea, Select } from "@/components/ui";
import { X } from "@phosphor-icons/react";

interface MarkDealLostModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: {
    reason: string;
    competitor: string;
    notes: string;
  }) => void;
}

const lossReasons = [
  { value: "", label: "Select a reason..." },
  { value: "price", label: "Price too high" },
  { value: "competitor", label: "Lost to competitor" },
  { value: "budget", label: "Budget constraints" },
  { value: "timing", label: "Bad timing" },
  { value: "no-decision", label: "No decision made" },
  { value: "features", label: "Missing features" },
  { value: "relationship", label: "Relationship issues" },
  { value: "other", label: "Other" },
];

export function MarkDealLostModal({
  open,
  onClose,
  onConfirm,
}: MarkDealLostModalProps) {
  const [reason, setReason] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [notes, setNotes] = useState("");

  const handleConfirm = () => {
    onConfirm({ reason, competitor, notes });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-neutral-800">
        <h2 className="text-xl font-serif text-neutral-950 dark:text-neutral-50">
          Mark Deal as Lost
        </h2>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="p-5 space-y-5">
        {/* Reason for Loss */}
        <Select
          label="Reason for Loss"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          options={lossReasons}
        />

        {/* Competitor Name */}
        <Input
          label="Competitor Name (if applicable)"
          value={competitor}
          onChange={(e) => setCompetitor(e.target.value)}
          placeholder="e.g., Salesforce, Hubspot"
        />

        {/* Notes */}
        <Textarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What could we have done differently?"
          rows={4}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 p-5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          className="bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white border-red-600 hover:border-red-700"
        >
          Confirm Lost
        </Button>
      </div>
    </Modal>
  );
}
