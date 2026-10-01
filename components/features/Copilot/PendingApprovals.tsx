"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CaretDownIcon, CaretRightIcon } from "@/components/ui";
import { listPendingApprovalsAction, resolveApproval } from "@/lib/actions/copilot-approvals";
import { ApprovalCard } from "./ApprovalCard";

export type PendingApproval = Awaited<ReturnType<typeof listPendingApprovalsAction>>[number];

const RESOLVE_MESSAGES = {
  applied: { ok: true, text: "Change applied" },
  denied: { ok: true, text: "Change denied" },
  stale: { ok: false, text: "This record changed since the proposal, so nothing was applied" },
  failed: { ok: false, text: "The change could not be applied" },
  invalid: { ok: false, text: "This approval is no longer pending" },
} as const;

/** Approvals proposed by scheduled tasks; chat approvals are answered inside their chat. */
function taskApprovals(rows: PendingApproval[]): PendingApproval[] {
  return rows.filter((row) => row.source === "task");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Strip above the Copilot content listing task-sourced approvals that still wait for an answer. */
export function PendingApprovals({
  initialItems,
  defaultOpen = false,
}: {
  initialItems: PendingApproval[];
  defaultOpen?: boolean;
}) {
  const [items, setItems] = useState(() => taskApprovals(initialItems));
  const [open, setOpen] = useState(defaultOpen);
  const [answering, setAnswering] = useState<Record<string, boolean>>({});

  const refresh = async () => {
    try {
      setItems(taskApprovals(await listPendingApprovalsAction()));
    } catch (error) {
      console.error("Copilot: refreshing pending approvals failed:", error);
    }
  };

  const answer = async (row: PendingApproval, approved: boolean) => {
    setAnswering((prev) => ({ ...prev, [row.id]: approved }));
    try {
      const { status } = await resolveApproval(row.id, approved);
      const message = RESOLVE_MESSAGES[status];
      if (message.ok) toast.success(message.text);
      else toast.error(message.text);
    } catch {
      toast.error("Could not answer this approval. Try again.");
    }
    await refresh();
    setAnswering((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => id !== row.id)));
  };

  if (items.length === 0) return null;

  return (
    <section aria-label="Pending approvals" className="shrink-0 border-b border-divider">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex h-10 w-full items-center gap-2 px-8 text-left text-[14px] font-medium text-fg transition-colors hover:bg-subtle max-sm:px-4"
      >
        {open ? <CaretDownIcon size={14} className="text-fg-muted" /> : <CaretRightIcon size={14} className="text-fg-muted" />}
        Pending approvals
        <span className="text-fg-muted">{items.length}</span>
      </button>
      {open && (
        <div className="max-h-[50vh] overflow-y-auto px-8 pb-2 max-sm:px-4">
          {items.map((row) => (
            <div key={row.id}>
              <ApprovalCard
                toolName={row.toolName}
                diff={row.diff}
                responded={row.id in answering ? { approved: answering[row.id] } : undefined}
                onApprove={() => void answer(row, true)}
                onDeny={() => void answer(row, false)}
              />
              <p className="pb-3 text-[12px] text-fg-muted">Proposed by a scheduled task on {formatDate(row.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
