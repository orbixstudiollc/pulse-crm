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
import { type PipelineStage, pipelineStages } from "@/lib/data/sales";

interface AddDealModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (data: DealFormData) => void;
  initialData?: DealFormData;
  mode?: "add" | "edit";
}

export interface DealFormData {
  name: string;
  customer: string;
  value: string;
  stage: PipelineStage;
  probability: string;
  expectedClose: string;
  notes: string;
}

const stageOptions = pipelineStages
  .filter((s) => s.id !== "closed_won" && s.id !== "closed_lost")
  .map((stage) => ({
    value: stage.id,
    label: stage.label,
  }));

const probabilityOptions = [
  { value: "10", label: "10%" },
  { value: "25", label: "25%" },
  { value: "50", label: "50%" },
  { value: "75", label: "75%" },
  { value: "90", label: "90%" },
];

// Mock customers - in real app, this would come from API/data
const customerOptions = [
  { value: "", label: "Select customer..." },
  { value: "James Wilson", label: "James Wilson" },
  { value: "Sarah Chen", label: "Sarah Chen" },
  { value: "Michael Torres", label: "Michael Torres" },
  { value: "Emily Richards", label: "Emily Richards" },
  { value: "David Kim", label: "David Kim" },
  { value: "Alexandra Foster", label: "Alexandra Foster" },
];

const emptyFormData: DealFormData = {
  name: "",
  customer: "",
  value: "",
  stage: "discovery",
  probability: "25",
  expectedClose: "",
  notes: "",
};

// Inner form component that resets when initialData changes via key prop
function DealForm({
  initialData,
  onClose,
  onSubmit,
  isEdit,
}: {
  initialData: DealFormData;
  onClose: () => void;
  onSubmit?: (data: DealFormData) => void;
  isEdit: boolean;
}) {
  const [formData, setFormData] = useState<DealFormData>(initialData);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.customer) {
      return;
    }
    onSubmit?.(formData);
    onClose();
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-neutral-800">
        <h2 className="text-xl font-serif text-neutral-950 dark:text-neutral-50">
          {isEdit ? "Edit Deal" : "Add Deal"}
        </h2>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
        {/* Deal Name */}
        <Input
          label="Deal Name"
          required
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Enterprise Suite"
        />

        {/* Customer */}
        <Select
          label="Customer"
          name="customer"
          value={formData.customer}
          onChange={handleChange}
          options={customerOptions}
        />

        {/* Value & Stage */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Value"
            type="number"
            name="value"
            value={formData.value}
            onChange={handleChange}
            placeholder="0"
            prefix="$"
          />
          <Select
            label="Stage"
            name="stage"
            value={formData.stage}
            onChange={handleChange}
            options={stageOptions}
          />
        </div>

        {/* Probability & Expected Close */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Probability"
            name="probability"
            value={formData.probability}
            onChange={handleChange}
            options={probabilityOptions}
          />
          <Input
            label="Expected Close"
            type="date"
            name="expectedClose"
            value={formData.expectedClose}
            onChange={handleChange}
          />
        </div>

        {/* Notes */}
        <Textarea
          label="Notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          placeholder="Add notes about this deal..."
          rows={3}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 p-5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          leftIcon={isEdit ? <CheckIcon size={18} /> : <PlusIcon size={18} />}
        >
          {isEdit ? "Save Changes" : "Add Deal"}
        </Button>
      </div>
    </>
  );
}

export function AddDealModal({
  open,
  onClose,
  onSubmit,
  initialData,
  mode = "add",
}: AddDealModalProps) {
  const isEdit = mode === "edit";
  const formKey = isEdit && initialData ? initialData.name : "new";

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <DealForm
        key={formKey}
        initialData={initialData || emptyFormData}
        onClose={handleClose}
        onSubmit={onSubmit}
        isEdit={isEdit}
      />
    </Modal>
  );
}
