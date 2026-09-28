"use client";

import { useState } from "react";
import {
  Modal,
  Button,
  Input,
  Select,
  XIcon,
  CurrencyDollarIcon,
} from "@/components/ui";

interface CreateInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  customerPlan?: string;
  customerMrr?: number;
}

export function CreateInvoiceModal({
  open,
  onClose,
  customerPlan,
  customerMrr,
}: CreateInvoiceModalProps) {
  const [invoiceNumber, setInvoiceNumber] = useState("INV-2024-0042");
  const [description, setDescription] = useState(
    customerPlan
      ? `${customerPlan.charAt(0).toUpperCase() + customerPlan.slice(1)} License - January 2025`
      : "",
  );
  const [amount, setAmount] = useState(customerMrr?.toString() || "");
  const [currency, setCurrency] = useState("usd");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("net30");

  const handleCreate = () => {
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      {/* Header */}
      <div className="flex h-12 items-center justify-between px-4 border-b border-divider">
        <h2 className="text-heading-md text-fg">
          Create Invoice
        </h2>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary hover:bg-muted hover:text-fg transition-colors"
        >
          <XIcon size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Invoice Number */}
        <Input
          label="Invoice Number"
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
          placeholder="INV-2024-0042"
        />

        {/* Description */}
        <Input
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enterprise License - January 2025"
        />

        {/* Amount & Currency */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="2450"
            leftIcon={<CurrencyDollarIcon size={16} />}
          />
          <Select
            label="Currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {[
              { label: "USD", value: "usd" },
              { label: "EUR", value: "eur" },
              { label: "GBP", value: "gbp" },
              { label: "CAD", value: "cad" },
            ].map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Issue Date & Due Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Issue Date"
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
          <Input
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        {/* Payment Terms */}
        <Select
          label="Payment Terms"
          value={paymentTerms}
          onChange={(e) => setPaymentTerms(e.target.value)}
        >
          {[
            { label: "Due on Receipt", value: "receipt" },
            { label: "Net 15", value: "net15" },
            { label: "Net 30", value: "net30" },
            { label: "Net 45", value: "net45" },
            { label: "Net 60", value: "net60" },
          ].map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-divider">
        <Button variant="ghost" className="shrink-0" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleCreate}>Create Invoice</Button>
      </div>
    </Modal>
  );
}
