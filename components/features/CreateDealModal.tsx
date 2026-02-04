"use client";

import { useState } from "react";
import {
  Modal,
  Button,
  Input,
  Select,
  Textarea,
  XIcon,
  CurrencyDollarIcon,
} from "@/components/ui";

interface CreateDealModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateDealModal({ open, onClose }: CreateDealModalProps) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("usd");
  const [stage, setStage] = useState("proposal");
  const [probability, setProbability] = useState("50");
  const [closeDate, setCloseDate] = useState("");
  const [notes, setNotes] = useState("");

  const handleCreate = () => {
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
        <h2 className="text-lg font-serif text-neutral-950 dark:text-neutral-50">
          Create Deal
        </h2>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <XIcon size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="p-6 space-y-5">
        {/* Deal Name */}
        <Input
          label="Deal Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enterprise Expansion"
        />

        {/* Value & Currency */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Value"
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="45000"
            leftIcon={<CurrencyDollarIcon size={16} />}
          />
          <Select
            label="Currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            options={[
              { label: "USD", value: "usd" },
              { label: "EUR", value: "eur" },
              { label: "GBP", value: "gbp" },
              { label: "CAD", value: "cad" },
            ]}
          />
        </div>

        {/* Stage & Probability */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Stage"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            options={[
              { label: "Prospecting", value: "prospecting" },
              { label: "Qualification", value: "qualification" },
              { label: "Proposal", value: "proposal" },
              { label: "Negotiation", value: "negotiation" },
              { label: "Closed Won", value: "closed_won" },
              { label: "Closed Lost", value: "closed_lost" },
            ]}
          />
          <Select
            label="Probability"
            value={probability}
            onChange={(e) => setProbability(e.target.value)}
            options={[
              { label: "10%", value: "10" },
              { label: "25%", value: "25" },
              { label: "50%", value: "50" },
              { label: "75%", value: "75" },
              { label: "90%", value: "90" },
              { label: "100%", value: "100" },
            ]}
          />
        </div>

        {/* Expected Close Date */}
        <Input
          label="Expected Close Date"
          type="date"
          value={closeDate}
          onChange={(e) => setCloseDate(e.target.value)}
        />

        {/* Notes */}
        <Textarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Customer looking to expand to 50 seats"
          rows={3}
        />
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 p-6 border-t border-neutral-200 dark:border-neutral-800">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleCreate}>Create Deal</Button>
      </div>
    </Modal>
  );
}
