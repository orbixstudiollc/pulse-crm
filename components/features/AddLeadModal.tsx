"use client";

import { useState } from "react";
import {
  Modal,
  Button,
  Input,
  Select,
  Textarea,
  PlusIcon,
  CheckIcon,
} from "@/components/ui";

import { X } from "@phosphor-icons/react";

interface AddLeadModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (data: LeadFormData) => void;
  initialData?: LeadFormData;
  mode?: "add" | "edit";
}

export interface LeadFormData {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  phone: string;
  source: string;
  value: string;
  notes: string;
}

const sourceOptions = [
  { label: "Website", value: "website" },
  { label: "Referral", value: "referral" },
  { label: "LinkedIn", value: "linkedin" },
  { label: "Cold Outreach", value: "cold-outreach" },
  { label: "Event", value: "event" },
  { label: "Google Ads", value: "google-ads" },
  { label: "Cold Call", value: "cold-call" },
];

const emptyFormData: LeadFormData = {
  firstName: "",
  lastName: "",
  email: "",
  company: "",
  phone: "",
  source: "",
  value: "",
  notes: "",
};

export function AddLeadModal({
  open,
  onClose,
  onSubmit,
  initialData,
  mode = "add",
}: AddLeadModalProps) {
  const [formData, setFormData] = useState<LeadFormData>(
    initialData || emptyFormData,
  );

  const isEdit = mode === "edit";

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    if (!formData.firstName || !formData.lastName || !formData.email) {
      return;
    }

    onSubmit?.(formData);
    if (!isEdit) {
      setFormData(emptyFormData);
    }
    onClose();
  };

  const handleClose = () => {
    if (!isEdit) {
      setFormData(emptyFormData);
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose}>
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-neutral-800">
        <h2 className="text-xl font-serif text-neutral-950 dark:text-neutral-50">
          {isEdit ? "Edit Lead" : "Add Lead"}
        </h2>
        <button
          onClick={handleClose}
          className="flex h-9 w-9 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
        {/* Name Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="First Name"
            required
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            placeholder="John"
          />
          <Input
            label="Last Name"
            required
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            placeholder="Smith"
          />
        </div>

        {/* Email */}
        <Input
          label="Email"
          required
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="john@company.com"
        />

        {/* Company & Phone Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Company"
            name="company"
            value={formData.company}
            onChange={handleChange}
            placeholder="Acme Inc."
          />
          <Input
            label="Phone"
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="+1 (555) 000-0000"
          />
        </div>

        {/* Source & Value Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Source"
            name="source"
            value={formData.source}
            onChange={handleChange}
            options={sourceOptions}
            placeholder="Select source..."
          />
          <Input
            label="Estimated Value"
            type="number"
            name="value"
            value={formData.value}
            onChange={handleChange}
            placeholder="0"
            prefix="$"
          />
        </div>

        {/* Notes */}
        <Textarea
          label="Notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          placeholder="Add any initial notes about this lead..."
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 p-5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
        <Button variant="outline" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          leftIcon={
            isEdit ? (
              <CheckIcon size={18} weight="bold" />
            ) : (
              <PlusIcon size={18} weight="bold" />
            )
          }
        >
          {isEdit ? "Save Changes" : "Add Lead"}
        </Button>
      </div>
    </Modal>
  );
}
