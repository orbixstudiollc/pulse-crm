"use client";

import type { ReactNode } from "react";
import { getToolName, isToolUIPart, type UIMessage } from "ai";
import type { FieldDiff } from "@/lib/ai/tools/diff";
import { TOOL_LABELS } from "@/lib/ai/tools/labels";
import { ApprovalCard } from "./ApprovalCard";
import { StepTrace, type TraceStep } from "./StepTrace";
import { UndoButton, type UndoInfo } from "./UndoButton";

export type ChatMessagePartsProps = {
  message: UIMessage;
  /**
   * True when this message is the conversation's last message and the assistant's. Only
   * its approval cards can still be answered; older cards render as expired.
   */
  isLatest: boolean;
  onApprove(approvalId: string): void;
  onDeny(approvalId: string, reason?: string): void;
  /** Called after a low-risk write was undone. */
  onUndo(info: UndoInfo): void;
};

type Part = UIMessage["parts"][number];
type ToolPart = Extract<Part, { state: string }>;

const STALE_TEXT = "This record changed since the proposal; ask again";
const FANOUT_TEXT = "Copilot can propose at most 20 changes per turn; ask again for the rest.";
const AUTOMATIONS_NOTE = "Automations not triggered";
const NOTICE_TEXT: Record<string, string> = {
  no_tools: "This model cannot take actions, so Copilot answered without using tools.",
  invalid_approval: "That approval is no longer valid. The conversation was refreshed.",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

/** The diff for an approval card: the approval descriptor, else the data-approval-diff part with the same toolCallId. */
function findDiff(parts: Part[], toolCallId: string, descriptor: unknown): FieldDiff | null {
  if (descriptor) return descriptor as FieldDiff;
  for (const part of parts) {
    if (part.type !== "data-approval-diff") continue;
    const data = (part as { id?: string; data?: unknown }).data;
    if ((part as { id?: string }).id === toolCallId && data) return data as FieldDiff;
  }
  return null;
}

/** The undo handle of a low-risk write result, at the top level or inside `data`. */
function findUndo(output: Record<string, unknown>): UndoInfo | null {
  const candidates = [output.undo, asRecord(output.data)?.undo];
  for (const candidate of candidates) {
    const undo = asRecord(candidate);
    if (!undo) continue;
    if ((undo.tool === "save_artifact" || undo.tool === "save_memory") && typeof undo.id === "string") {
      return { tool: undo.tool, id: undo.id };
    }
  }
  return null;
}

function resultStep(id: string, label: string, output: unknown, onUndo: (info: UndoInfo) => void): TraceStep {
  const result = asRecord(output);
  if (result?.ok === false) {
    const error = typeof result.error === "string" ? result.error : "failed";
    if (error === "record_changed") return { id, label, status: "stale", detail: STALE_TEXT };
    if (error === "fanout_limit") {
      const message = typeof result.message === "string" ? result.message : FANOUT_TEXT;
      return { id, label, status: "failed", detail: message };
    }
    return { id, label, status: "failed", detail: error };
  }
  const skipped = Array.isArray(result?.automationsSkipped) && result.automationsSkipped.length > 0;
  const undo = result ? findUndo(result) : null;
  return {
    id,
    label,
    status: "done",
    ...(skipped ? { note: AUTOMATIONS_NOTE } : {}),
    ...(undo ? { action: <UndoButton info={undo} onUndone={onUndo} /> } : {}),
  };
}

function toolStep(part: ToolPart, onUndo: (info: UndoInfo) => void): TraceStep {
  const toolName = getToolName(part as Parameters<typeof getToolName>[0]);
  const id = (part as { toolCallId: string }).toolCallId;
  const label = TOOL_LABELS[toolName] ?? toolName;
  switch (part.state) {
    case "output-available":
      return resultStep(id, label, part.output, onUndo);
    case "output-error":
      return { id, label, status: "failed", detail: part.errorText };
    case "output-denied":
      return { id, label, status: "denied", detail: "Denied" };
    default:
      return { id, label, status: "running" };
  }
}

/** Renders one chat message: text, a step trace for tool calls, and approval cards for proposed writes. */
export function ChatMessageParts({ message, isLatest, onApprove, onDeny, onUndo }: ChatMessagePartsProps) {
  const blocks: ReactNode[] = [];
  let steps: TraceStep[] = [];
  // Keyed by the group's first tool call, so a group keeps its state (e.g. Undone) as parts stream in.
  const flushSteps = () => {
    if (steps.length > 0) blocks.push(<StepTrace key={`steps-${steps[0].id}`} steps={steps} />);
    steps = [];
  };

  message.parts.forEach((part, index) => {
    const key = `${message.id}-${index}`;
    if (part.type === "text") {
      flushSteps();
      if (part.text) {
        blocks.push(
          <p key={key} className="whitespace-pre-wrap py-1.5 text-[14px] leading-6 text-fg">
            {part.text}
          </p>,
        );
      }
      return;
    }
    if (part.type === "data-notice") {
      flushSteps();
      const code = (part as { data?: { code?: unknown } }).data?.code;
      const text = typeof code === "string" ? NOTICE_TEXT[code] : undefined;
      if (text) {
        blocks.push(
          <p key={key} className="border-t border-divider py-2 text-[13px] text-fg-muted">
            {text}
          </p>,
        );
      }
      return;
    }
    if (!isToolUIPart(part)) return;

    const tool = part as ToolPart;
    if (tool.state === "approval-requested" || tool.state === "approval-responded") {
      flushSteps();
      const toolCallId = (tool as { toolCallId: string }).toolCallId;
      const approvalId = tool.approval.id;
      blocks.push(
        <ApprovalCard
          key={`approval-${toolCallId}`}
          toolName={getToolName(tool as Parameters<typeof getToolName>[0])}
          diff={findDiff(message.parts, toolCallId, tool.approval.descriptor)}
          responded={tool.state === "approval-responded" ? { approved: tool.approval.approved } : undefined}
          expired={!isLatest}
          onApprove={() => onApprove(approvalId)}
          onDeny={(reason) => onDeny(approvalId, reason)}
        />,
      );
      return;
    }
    steps.push(toolStep(tool, onUndo));
  });
  flushSteps();

  return <div>{blocks}</div>;
}
