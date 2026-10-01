"use client";

import { useEffect, useRef, useState } from "react";
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
import { toast } from "sonner";
import { type PipelineStage, pipelineStages } from "@/lib/data/sales";
import { searchRecords, type RecordResult } from "@/lib/actions/lookup";

/** Resolve to false to keep the modal open, e.g. when the save failed. */
type DealSubmit = (data: DealFormData) => boolean | void | Promise<boolean | void>;

interface AddDealModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: DealSubmit;
  initialData?: DealFormData;
  mode?: "add" | "edit";
}

export interface DealFormData {
  name: string;
  /** Display name of the selected customer. */
  customer: string;
  /** Real customer id, set when a customer is picked from search. */
  customerId?: string;
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

const SEARCH_DEBOUNCE_MS = 250;

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
  onSubmit?: DealSubmit;
  isEdit: boolean;
}) {
  const [formData, setFormData] = useState<DealFormData>(initialData);
  const [submitting, setSubmitting] = useState(false);
  const [customerQuery, setCustomerQuery] = useState(initialData.customer);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<RecordResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const customerRef = useRef<HTMLDivElement>(null);

  // Debounced typeahead over the org's real customers
  useEffect(() => {
    if (!showResults) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const found = await searchRecords(customerQuery, ["customer"]);
        if (!cancelled) setResults(found);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [customerQuery, showResults]);

  // Close results when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        customerRef.current &&
        !customerRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectCustomer = (record: RecordResult) => {
    setFormData((prev) => ({
      ...prev,
      customer: record.label,
      customerId: record.id,
    }));
    setCustomerQuery(record.label);
    setShowResults(false);
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.customer) {
      toast.error("Deal name and customer are required");
      return;
    }
    setSubmitting(true);
    try {
      if ((await onSubmit?.(formData)) === false) return;
    } finally {
      setSubmitting(false);
    }
    onClose();
  };

  return (
    <>
      {/* Header */}
      <div className="flex h-12 items-center justify-between px-4 border-b border-divider">
        <h2 className="text-heading-md text-fg">
          {isEdit ? "Edit Deal" : "Add Deal"}
        </h2>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary hover:bg-muted hover:text-fg transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
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
        <div ref={customerRef} className="relative">
          <Input
            label="Customer"
            value={customerQuery}
            onChange={(e) => {
              setCustomerQuery(e.target.value);
              setFormData((prev) => ({
                ...prev,
                customer: "",
                customerId: undefined,
              }));
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            placeholder="Search customers..."
            autoComplete="off"
          />
          {showResults && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-line rounded-lg shadow-dropdown z-10 max-h-60 overflow-y-auto">
              {results.length > 0 ? (
                results.map((record) => (
                  <button
                    key={record.id}
                    type="button"
                    onClick={() => selectCustomer(record)}
                    className="w-full flex flex-col px-3 py-2 hover:bg-muted transition-colors text-left"
                  >
                    <span className="text-sm font-medium text-fg">
                      {record.label}
                    </span>
                    {record.sublabel && (
                      <span className="text-xs text-fg-secondary">
                        {record.sublabel}
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-fg-secondary">
                  {isSearching ? "Searching..." : "No customers found"}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Value & Stage */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          >
            {stageOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Probability & Expected Close */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Probability"
            name="probability"
            value={formData.probability}
            onChange={handleChange}
          >
            {probabilityOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
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
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-divider bg-subtle">
        <Button variant="ghost" className="shrink-0" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          loading={submitting}
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
