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

  useEffect(() => {
    if (open) {
      setLoading(true);
      setSelectedId(null);
      setSearch("");
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
    active: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    draft: "bg-neutral-500/15 text-neutral-400 border-neutral-500/30",
    paused: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-800">
            <PaperPlaneTiltIcon className="w-5 h-5 text-neutral-950 dark:text-neutral-50" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">Add to Sequence</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{leadIds.length} lead{leadIds.length !== 1 ? "s" : ""} selected</p>
          </div>
        </div>

        <div className="relative mb-3">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search sequences..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-950 dark:text-neutral-50 placeholder:text-neutral-400"
          />
        </div>

        <div className="space-y-1 max-h-64 overflow-y-auto mb-4">
          {loading ? (
            <div className="space-y-2 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
              ))}
            </div>
          ) : filtered.length > 0 ? (
            filtered.map((seq) => (
              <button
                key={seq.id}
                onClick={() => setSelectedId(seq.id)}
                className={`w-full flex items-center justify-between p-3 rounded border text-left transition-colors ${
                  selectedId === seq.id
                    ? "border-neutral-950 dark:border-white bg-neutral-50 dark:bg-neutral-800"
                    : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50 truncate">{seq.name}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {seq.total_steps} step{seq.total_steps !== 1 ? "s" : ""} · {seq.total_enrolled} enrolled
                  </p>
                </div>
                <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded border ${statusColor[seq.status] || statusColor.draft}`}>
                  {seq.status}
                </span>
              </button>
            ))
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-8">
              {search ? "No matching sequences" : "No sequences found. Create one first."}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleEnroll}
            disabled={!selectedId || isPending}
            className="flex-1 px-4 py-2 text-sm font-medium bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 rounded hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-50"
          >
            {isPending ? "Enrolling..." : `Enroll ${leadIds.length} Lead${leadIds.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
