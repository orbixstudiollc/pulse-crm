"use client";

import { Button } from "@/components/ui/Button";
import type { FieldDiff } from "@/lib/ai/tools/diff";
import { TOOL_LABELS } from "@/lib/ai/tools/labels";

export type ApprovalCardProps = {
  toolName: string;
  /** Null when no diff reached the client; the card then asks without details. */
  diff: FieldDiff | null;
  onApprove(): void;
  onDeny(reason?: string): void;
  /** Set once the user has answered: both buttons lock and the answer is shown. */
  responded?: { approved: boolean };
};

function fieldLabel(name: string): string {
  return name.replace(/_/g, " ");
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function UpdateTable({ fields }: { fields: FieldDiff["fields"] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[320px] table-fixed text-left text-[13px]">
        <thead>
          <tr className="border-b border-divider text-fg-secondary">
            <th className="h-8 w-1/4 pr-3 font-medium">Field</th>
            <th className="h-8 w-[37.5%] pr-3 font-medium">Before</th>
            <th className="h-8 w-[37.5%] font-medium">After</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field.name} className="border-b border-divider align-top">
              <td className="py-1.5 pr-3 text-fg-muted">{fieldLabel(field.name)}</td>
              <td className="break-words py-1.5 pr-3 text-fg-secondary">{formatValue(field.before)}</td>
              <td className="break-words py-1.5 text-fg">{formatValue(field.after)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CreateList({ fields }: { fields: FieldDiff["fields"] }) {
  return (
    <dl className="mt-3 grid grid-cols-[120px_1fr] gap-y-1.5 text-[13px]">
      {fields.map((field) => (
        <div key={field.name} className="contents">
          <dt className="text-fg-muted">{fieldLabel(field.name)}</dt>
          <dd className="break-words text-fg">{formatValue(field.after)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Asks the user to approve one proposed write, with the before/after of what it would change. */
export function ApprovalCard({ toolName, diff, onApprove, onDeny, responded }: ApprovalCardProps) {
  const locked = responded !== undefined;
  const title = TOOL_LABELS[toolName] ?? toolName;
  return (
    <section className="border-t border-divider py-3" aria-label="Approval needed">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[14px] font-semibold text-fg">{title}</h3>
        <span className="text-[12px] text-fg-muted">
          {responded ? (responded.approved ? "Approved" : "Denied") : "Approval needed"}
        </span>
      </div>
      {diff && diff.fields.length > 0 ? (
        diff.kind === "update" ? (
          <UpdateTable fields={diff.fields} />
        ) : (
          <CreateList fields={diff.fields} />
        )
      ) : (
        <p className="mt-2 text-[13px] text-fg-muted">No field details are available for this change.</p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" disabled={locked} onClick={onApprove}>
          Approve
        </Button>
        <Button size="sm" variant="secondary" disabled={locked} onClick={() => onDeny()}>
          Deny
        </Button>
      </div>
    </section>
  );
}
