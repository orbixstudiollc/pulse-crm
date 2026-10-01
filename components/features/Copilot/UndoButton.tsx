"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ArrowCounterClockwiseIcon } from "@/components/ui/Icons";
import { undoCopilotWrite } from "@/lib/actions/copilot-approvals";

export type UndoInfo = { tool: "save_artifact" | "save_memory"; id: string };

type UndoState = "idle" | "pending" | "done" | "failed";

/** Reverts a low-risk Copilot write; `onUndone` tells the parent once it worked. */
export function UndoButton({ info, onUndone }: { info: UndoInfo; onUndone?: (info: UndoInfo) => void }) {
  const [state, setState] = useState<UndoState>("idle");

  if (state === "done") return <span className="shrink-0 text-[13px] text-fg-muted">Undone</span>;

  async function undo() {
    setState("pending");
    try {
      const result = await undoCopilotWrite(info);
      if (!result.ok) {
        setState("failed");
        return;
      }
      setState("done");
      onUndone?.(info);
    } catch {
      setState("failed");
    }
  }

  return (
    <span className="flex shrink-0 items-center gap-2">
      {state === "failed" && <span className="text-[13px] text-danger">Could not undo</span>}
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<ArrowCounterClockwiseIcon size={14} />}
        loading={state === "pending"}
        onClick={() => void undo()}
      >
        Undo
      </Button>
    </span>
  );
}
