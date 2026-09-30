"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Modal, Badge } from "@/components/ui";
import { PaperPlaneTiltIcon, MagnifyingGlassIcon } from "@/components/ui/Icons";
import { getSequences, enrollLeadsBulk } from "@/lib/actions/sequences";

interface SequencePickerModalProps {
  open: boolean;
  onClose: () => void;
  leadIds: string[];
  onComplete?: (result: { enrolled: number; errors: number }) => void;
}

export function SequencePickerModal({ open, onClose, leadIds, onComplete }: SequencePickerModalProps) {
  const [sequences, setSequences] = useState<Array<{
    id: string; name: string; status: string; total_enrolled: number; total_steps: number;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [wasOpen, setWasOpen] = useState(false);

  // Reset selection when the modal opens (adjusted during render, not in an effect)
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setLoading(true);
      setSelectedId(null);
      setSearch("");
    }
  }

  useEffect(() => {
    if (open) {
      getSequences().then((res) => {
        setSequences((res.data ?? []).map((s) => ({
          id: s.id, name: s.name, status: s.status,
          total_enrolled: s.total_enrolled, total_steps: s.total_steps,
        })));
        setLoading(false);
      });
    }
  }, [open]);

  const filtered = sequences.filter((s) => {
    if (search) {
      return s.name.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const handleEnroll = () => {
    if (!selectedId || leadIds.length === 0) return;
    startTransition(async () => {
      const toastId = toast.loading(`Enrolling ${leadIds.length} leads...`);
      const result = await enrollLeadsBulk(selectedId, leadIds);
      if (result.errors > 0 && result.enrolled > 0) {
        toast.warning(`${result.enrolled} enrolled, ${result.errors} already in sequence`, { id: toastId });
      } else if (result.enrolled === 0) {
        toast.info("All leads are already enrolled in this sequence", { id: toastId });
      } else {
        toast.success(`${result.enrolled} leads enrolled successfully`, { id: toastId });
      }
      onComplete?.(result);
      onClose();
    });
  };

  const statusColor: Record<string, string> = {
    active: "bg-success-surface text-success",
    draft: "bg-muted text-fg-secondary",
    paused: "bg-warning-surface text-warning",
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <div className="w-full max-w-md p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-line">
            <PaperPlaneTiltIcon className="w-4 h-4 text-fg" />
          </div>
          <div>
            <h3 className="text-heading-md text-fg">Add to Sequence</h3>
            <p className="text-xs text-fg-secondary">{leadIds.length} lead{leadIds.length !== 1 ? "s" : ""} selected</p>
          </div>
        </div>

        <div className="relative mb-3">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
          <input
            type="text"
            placeholder="Search sequences..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-9 pr-3 text-sm rounded-md border border-line bg-surface text-fg placeholder:text-fg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>

        <div className="space-y-1 max-h-64 overflow-y-auto mb-4">
          {loading ? (
            <div className="space-y-2 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          ) : filtered.length > 0 ? (
            filtered.map((seq) => (
              <button
                key={seq.id}
                onClick={() => setSelectedId(seq.id)}
                className={`w-full flex items-center justify-between p-3 rounded-md border text-left transition-colors ${
                  selectedId === seq.id
                    ? "border-accent bg-accent-surface text-accent-on-surface"
                    : "border-line hover:border-fg-muted"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg truncate">{seq.name}</p>
                  <p className="text-xs text-fg-secondary">
                    {seq.total_steps} step{seq.total_steps !== 1 ? "s" : ""} · {seq.total_enrolled} enrolled
                  </p>
                </div>
                <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColor[seq.status] || statusColor.draft}`}>
                  {seq.status}
                </span>
              </button>
            ))
          ) : (
            <p className="text-sm text-fg-secondary text-center py-8">
              {search ? "No matching sequences" : "No sequences found. Create one first."}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 h-8 px-3 text-sm font-medium text-fg-secondary rounded-md hover:bg-muted hover:text-fg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleEnroll}
            disabled={!selectedId || isPending}
            className="flex-1 h-8 px-3 text-sm font-medium bg-accent-strong text-on-inverse hover:bg-accent-strong/90 rounded-md transition-colors disabled:opacity-50"
          >
            {isPending ? "Enrolling..." : `Enroll ${leadIds.length} Lead${leadIds.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
