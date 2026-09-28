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
      <div className="flex h-12 items-center justify-between px-4 border-b border-divider">
        <h2 className="text-heading-md text-fg">
          Mark Deal as Lost
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
        {/* Reason for Loss */}
        <Select
          label="Reason for Loss"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        >
          {lossReasons.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>

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
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-divider bg-subtle">
        <Button variant="ghost" className="shrink-0" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          className="bg-danger text-on-inverse hover:opacity-90"
        >
          Confirm Lost
        </Button>
      </div>
    </Modal>
  );
}
