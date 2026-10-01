"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CopyIcon, FileTextIcon, StarIcon, TrashIcon, XIcon } from "@/components/ui";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Button } from "@/components/ui/Button";
import { EmptyState, Page, PageHeader } from "@/components/dashboard";
import {
  deleteArtifact,
  listArtifacts,
  restoreArtifact,
  setArtifactStarred,
} from "@/lib/actions/copilot-artifacts";
import type { CopilotArtifactKind } from "@/types/database";
import { FIELD } from "./styles";

export type Artifact = Awaited<ReturnType<typeof listArtifacts>>[number];

type KindFilter = "all" | CopilotArtifactKind;

const KIND_LABELS: Record<CopilotArtifactKind, string> = {
  email_draft: "Email draft",
  lead_list: "Lead list",
  report: "Report",
  note: "Note",
};
const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "email_draft", label: "Emails" },
  { value: "lead_list", label: "Lead lists" },
  { value: "report", label: "Reports" },
  { value: "note", label: "Notes" },
];
const SEARCH_DEBOUNCE_MS = 250;
const MAX_TABLE_COLUMNS = 8;
const TEXT_KEYS = ["text", "body", "content", "markdown"];

// ── Content helpers ────────────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/** The readable text of a report or note; anything without a text field is shown as JSON. */
function contentText(content: unknown): string {
  if (typeof content === "string") return content;
  const record = asRecord(content);
  for (const key of TEXT_KEYS) {
    if (typeof record[key] === "string") return record[key] as string;
  }
  return JSON.stringify(content, null, 2);
}

/** The rows of a lead list: the content itself or its first array of objects. */
function leadRows(content: unknown): Record<string, unknown>[] {
  const list = Array.isArray(content) ? content : Object.values(asRecord(content)).find(Array.isArray);
  return ((list ?? []) as unknown[]).map(asRecord).filter((row) => Object.keys(row).length > 0);
}

function emailText(content: unknown): { to: string; subject: string; body: string } {
  const record = asRecord(content);
  return {
    to: typeof record.to === "string" ? record.to : "",
    subject: typeof record.subject === "string" ? record.subject : "",
    body: typeof record.body === "string" ? record.body : "",
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const byNewest = (a: Artifact, b: Artifact) => b.created_at.localeCompare(a.created_at);

// ── Detail pane ────────────────────────────────────────────────────────────

function EmailDraftBody({ content }: { content: unknown }) {
  const { to, subject, body } = emailText(content);
  const copy = async () => {
    const text = `${to ? `To: ${to}\n` : ""}Subject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Email copied");
    } catch {
      toast.error("Could not copy the email");
    }
  };
  return (
    <div>
      <dl className="grid grid-cols-[72px_1fr] gap-y-2 text-[13px]">
        <dt className="text-fg-muted">To</dt>
        <dd className="min-w-0 break-words text-fg">{to || "-"}</dd>
        <dt className="text-fg-muted">Subject</dt>
        <dd className="min-w-0 break-words text-fg">{subject || "-"}</dd>
      </dl>
      <p className="mt-4 whitespace-pre-wrap break-words border-t border-divider pt-4 text-[13px] leading-6 text-fg">{body}</p>
      <div className="mt-4">
        <Button size="sm" variant="secondary" leftIcon={<CopyIcon size={14} />} onClick={() => void copy()}>
          Copy
        </Button>
      </div>
    </div>
  );
}

function LeadListBody({ content }: { content: unknown }) {
  const rows = leadRows(content);
  if (rows.length === 0) return <p className="text-[13px] text-fg-muted">This list is empty.</p>;
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].slice(0, MAX_TABLE_COLUMNS);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-divider text-fg-secondary">
            {columns.map((column) => (
              <th key={column} className="h-8 whitespace-nowrap pr-3 font-medium">
                {column.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-divider align-top">
              {columns.map((column) => (
                <td key={column} className="break-words py-1.5 pr-3 text-fg">
                  {formatCell(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ArtifactDetail({
  artifact,
  onStar,
  onDelete,
  onClose,
}: {
  artifact: Artifact;
  onStar: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="px-6 py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-[16px] leading-6 font-semibold text-fg">{artifact.title}</h2>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            {KIND_LABELS[artifact.kind]} - {formatDate(artifact.created_at)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onStar}
            aria-pressed={artifact.starred}
            aria-label={artifact.starred ? "Remove star" : "Star artifact"}
            className="flex h-7 w-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-subtle hover:text-fg"
          >
            <StarIcon size={16} weight={artifact.starred ? "fill" : "regular"} className={artifact.starred ? "text-warning" : undefined} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete artifact"
            className="flex h-7 w-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-danger-surface hover:text-danger"
          >
            <TrashIcon size={16} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail"
            className="flex h-7 w-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-subtle hover:text-fg"
          >
            <XIcon size={16} />
          </button>
        </div>
      </div>
      <div className="mt-4 border-t border-divider pt-4">
        {artifact.kind === "email_draft" && <EmailDraftBody content={artifact.content} />}
        {artifact.kind === "lead_list" && <LeadListBody content={artifact.content} />}
        {(artifact.kind === "report" || artifact.kind === "note") && (
          <p className="whitespace-pre-wrap break-words text-[13px] leading-6 text-fg">{contentText(artifact.content)}</p>
        )}
      </div>
    </div>
  );
}

// ── Artifacts view ─────────────────────────────────────────────────────────

export function ArtifactsView({
  initialArtifacts,
  initialOpenId,
}: {
  initialArtifacts: Artifact[];
  initialOpenId: string | null;
}) {
  const [items, setItems] = useState(initialArtifacts);
  const [selected, setSelected] = useState<Artifact | null>(
    () => initialArtifacts.find((artifact) => artifact.id === initialOpenId) ?? null,
  );
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const requestRef = useRef(0);

  // The server is the source of truth: refetch on mount (chats may have saved artifacts since
  // the page loaded) and whenever the search text or kind changes. Stale answers are dropped.
  useEffect(() => {
    const request = ++requestRef.current;
    const timer = setTimeout(
      () => {
        listArtifacts({ q: query.trim() || undefined, kind: kind === "all" ? undefined : kind })
          .then((rows) => {
            if (requestRef.current === request) setItems(rows);
          })
          .catch((error) => console.error("Copilot: loading artifacts failed:", error));
      },
      query ? SEARCH_DEBOUNCE_MS : 0,
    );
    return () => clearTimeout(timer);
  }, [query, kind]);

  const needle = query.trim().toLowerCase();
  const visible = items.filter(
    (artifact) =>
      (kind === "all" || artifact.kind === kind) && (!needle || artifact.title.toLowerCase().includes(needle)),
  );

  const patch = (id: string, changes: Partial<Artifact>) => {
    setItems((prev) => prev.map((artifact) => (artifact.id === id ? { ...artifact, ...changes } : artifact)));
    setSelected((prev) => (prev?.id === id ? { ...prev, ...changes } : prev));
  };

  const toggleStar = async (artifact: Artifact) => {
    const starred = !artifact.starred;
    patch(artifact.id, { starred });
    try {
      const result = await setArtifactStarred(artifact.id, starred);
      if ("error" in result) throw new Error(result.error);
    } catch {
      patch(artifact.id, { starred: !starred });
      toast.error("Could not update the star");
    }
  };

  const restore = async (artifact: Artifact) => {
    try {
      const result = await restoreArtifact(artifact.id);
      if ("error" in result) throw new Error(result.error);
      setItems((prev) => [...prev.filter((item) => item.id !== artifact.id), { ...artifact, deleted_at: null }].sort(byNewest));
    } catch {
      toast.error("Could not restore the artifact");
    }
  };

  const remove = async (artifact: Artifact) => {
    try {
      const result = await deleteArtifact(artifact.id);
      if ("error" in result) throw new Error(result.error);
    } catch {
      toast.error("Could not delete the artifact");
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== artifact.id));
    setSelected((prev) => (prev?.id === artifact.id ? null : prev));
    toast("Artifact deleted", { action: { label: "Undo", onClick: () => void restore(artifact) } });
  };

  return (
    <div className="flex min-h-0 flex-1 max-lg:flex-col max-lg:overflow-y-auto">
      <div className="min-w-0 flex-1 overflow-y-auto max-lg:overflow-visible">
        <Page>
          <PageHeader
            icon={<FileTextIcon size={18} />}
            title="Artifacts"
            description="Reports, drafts and lead lists that Copilot saved for you."
          >
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search artifacts"
              aria-label="Search artifacts"
              className={cn(FIELD, "h-8 w-48")}
            />
          </PageHeader>
          <div className="px-8 pb-4 max-sm:px-4">
            <SegmentedControl options={KIND_OPTIONS} value={kind} onChange={setKind} aria-label="Filter by kind" />
          </div>
          {visible.length === 0 ? (
            <div className="border-t border-divider">
              <EmptyState
                icon={<FileTextIcon size={24} />}
                title={needle || kind !== "all" ? "No matching artifacts" : "No artifacts yet"}
                description={
                  needle || kind !== "all"
                    ? "Try a different search or filter."
                    : "Ask Copilot to draft an email or write a report and it will be saved here."
                }
              />
            </div>
          ) : (
            <ul className="border-t border-divider">
              {visible.map((artifact) => (
                <li
                  key={artifact.id}
                  className={cn(
                    "flex items-center gap-2 border-b border-divider pr-8 transition-colors hover:bg-subtle max-sm:pr-4",
                    selected?.id === artifact.id && "bg-subtle",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelected(artifact)}
                    className="min-w-0 flex-1 py-3 pl-8 text-left max-sm:pl-4"
                  >
                    <span className="block truncate text-[13px] font-medium text-fg">{artifact.title}</span>
                    <span className="block text-[12px] text-fg-muted">
                      {KIND_LABELS[artifact.kind]} - {formatDate(artifact.created_at)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleStar(artifact)}
                    aria-pressed={artifact.starred}
                    aria-label={artifact.starred ? "Remove star" : "Star artifact"}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-active hover:text-fg"
                  >
                    <StarIcon size={16} weight={artifact.starred ? "fill" : "regular"} className={artifact.starred ? "text-warning" : undefined} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Page>
      </div>
      {selected && (
        <aside className="w-[420px] shrink-0 overflow-y-auto border-l border-divider max-lg:w-full max-lg:border-l-0 max-lg:border-t">
          <ArtifactDetail
            artifact={selected}
            onStar={() => void toggleStar(selected)}
            onDelete={() => void remove(selected)}
            onClose={() => setSelected(null)}
          />
        </aside>
      )}
    </div>
  );
}
