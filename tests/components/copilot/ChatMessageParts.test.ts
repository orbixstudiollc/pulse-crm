// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { UIMessage } from "ai";

const { undoCopilotWrite } = vi.hoisted(() => ({ undoCopilotWrite: vi.fn() }));
vi.mock("@/lib/actions/copilot-approvals", () => ({ undoCopilotWrite }));

import { ChatMessageParts } from "@/components/features/Copilot/ChatMessageParts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

function render(message: UIMessage, handlers: Partial<{ onApprove: (id: string) => void; onDeny: (id: string, reason?: string) => void; onUndo: (info: unknown) => void }> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const props = { message, onApprove: vi.fn(), onDeny: vi.fn(), onUndo: vi.fn(), ...handlers } as {
    message: UIMessage;
    onApprove: Mock;
    onDeny: Mock;
    onUndo: Mock;
  };
  act(() => root!.render(createElement(ChatMessageParts, props)));
  return { container, props };
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  undoCopilotWrite.mockReset();
});

const updateDiff = {
  kind: "update",
  recordType: "lead",
  recordId: "lead-1",
  fields: [
    { name: "status", before: "cold", after: "hot" },
    { name: "next_followup", before: null, after: "2026-10-05" },
  ],
};

function approvalMessage(opts: { state: "approval-requested" | "approval-responded"; descriptor?: unknown; withDataPart?: boolean }): UIMessage {
  const approval =
    opts.state === "approval-requested"
      ? { id: "appr-1", ...(opts.descriptor ? { descriptor: opts.descriptor } : {}) }
      : { id: "appr-1", approved: true, ...(opts.descriptor ? { descriptor: opts.descriptor } : {}) };
  return {
    id: "m1",
    role: "assistant",
    parts: [
      ...(opts.withDataPart ? [{ type: "data-approval-diff", id: "call-1", data: updateDiff }] : []),
      { type: "tool-update_lead", toolCallId: "call-1", state: opts.state, input: { id: "lead-1", status: "hot" }, approval },
    ],
  } as unknown as UIMessage;
}

function toolResultMessage(output: unknown, toolName = "update_lead"): UIMessage {
  return {
    id: "m2",
    role: "assistant",
    parts: [{ type: `tool-${toolName}`, toolCallId: "call-2", state: "output-available", input: {}, output }],
  } as unknown as UIMessage;
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.trim() === text);
  if (!found) throw new Error(`no button "${text}"`);
  return found;
}

describe("ChatMessageParts approval cards", () => {
  it("renders before/after diff rows from the approval descriptor", () => {
    const { container } = render(approvalMessage({ state: "approval-requested", descriptor: updateDiff }));

    const rows = Array.from(container.querySelectorAll("tbody tr")).map((tr) =>
      Array.from(tr.querySelectorAll("td")).map((td) => td.textContent),
    );
    expect(rows).toEqual([
      ["status", "cold", "hot"],
      ["next followup", "-", "2026-10-05"],
    ]);
  });

  it("falls back to the data-approval-diff part with the same toolCallId", () => {
    const { container } = render(approvalMessage({ state: "approval-requested", withDataPart: true }));

    const rows = Array.from(container.querySelectorAll("tbody tr")).map((tr) => tr.textContent);
    expect(rows).toEqual(["statuscoldhot", "next followup-2026-10-05"]);
  });

  it("ignores a data-approval-diff part that belongs to another toolCallId", () => {
    const message = approvalMessage({ state: "approval-requested", withDataPart: true });
    (message.parts[0] as { id: string }).id = "call-other";

    const { container } = render(message);

    expect(container.querySelector("tbody")).toBeNull();
    expect(container.textContent).toContain("No field details");
  });

  it("lists the fields of a create as a field list, not a before/after table", () => {
    const createDiff = { kind: "create", recordType: "lead", fields: [{ name: "name", after: "Acme" }, { name: "status", after: "warm" }] };
    const { container } = render(approvalMessage({ state: "approval-requested", descriptor: createDiff }));

    expect(container.querySelector("table")).toBeNull();
    expect(Array.from(container.querySelectorAll("dt")).map((n) => n.textContent)).toEqual(["name", "status"]);
    expect(Array.from(container.querySelectorAll("dd")).map((n) => n.textContent)).toEqual(["Acme", "warm"]);
  });

  it("Approve calls onApprove with the approval id and Deny calls onDeny with it", () => {
    const { container, props } = render(approvalMessage({ state: "approval-requested", descriptor: updateDiff }));

    act(() => buttonByText(container, "Approve").click());
    expect(props.onApprove).toHaveBeenCalledTimes(1);
    expect(props.onApprove).toHaveBeenCalledWith("appr-1");

    act(() => buttonByText(container, "Deny").click());
    expect(props.onDeny).toHaveBeenCalledTimes(1);
    expect(props.onDeny.mock.calls[0][0]).toBe("appr-1");
  });

  it("enables both buttons while requested and disables them once approval-responded", () => {
    const requested = render(approvalMessage({ state: "approval-requested", descriptor: updateDiff }));
    expect(buttonByText(requested.container, "Approve").disabled).toBe(false);
    expect(buttonByText(requested.container, "Deny").disabled).toBe(false);
    act(() => root!.unmount());
    document.body.innerHTML = "";

    const responded = render(approvalMessage({ state: "approval-responded", descriptor: updateDiff }));
    const approve = buttonByText(responded.container, "Approve");
    const deny = buttonByText(responded.container, "Deny");
    expect(approve.disabled).toBe(true);
    expect(deny.disabled).toBe(true);
    act(() => approve.click());
    act(() => deny.click());
    expect(responded.props.onApprove).not.toHaveBeenCalled();
    expect(responded.props.onDeny).not.toHaveBeenCalled();
  });
});

describe("ChatMessageParts tool results", () => {
  it("labels a read from TOOL_LABELS and falls back to the tool name", () => {
    const { container } = render({
      id: "m3",
      role: "assistant",
      parts: [
        { type: "tool-search_leads", toolCallId: "a", state: "output-available", input: {}, output: { ok: true, data: [] } },
        { type: "tool-brand_new_tool", toolCallId: "b", state: "output-available", input: {}, output: { ok: true, data: [] } },
      ],
    } as unknown as UIMessage);

    const rows = Array.from(container.querySelectorAll("li")).map((li) => li.textContent);
    expect(rows).toEqual(["Searched leads", "brand_new_tool"]);
  });

  it("appends 'Automations not triggered' only when automations were skipped", () => {
    const skipped = render(toolResultMessage({ ok: true, data: {}, automationsSkipped: ["Notify owner"] }));
    expect(skipped.container.textContent).toContain("Updated lead");
    expect(skipped.container.textContent).toContain("Automations not triggered");
    act(() => root!.unmount());
    document.body.innerHTML = "";

    const none = render(toolResultMessage({ ok: true, data: {}, automationsSkipped: [] }));
    expect(none.container.textContent).not.toContain("Automations not triggered");
  });

  it("shows the stale-record text for a record_changed result", () => {
    const { container } = render(toolResultMessage({ ok: false, error: "record_changed" }));

    expect(container.textContent).toContain("This record changed since the proposal; ask again");
  });

  it("shows the limit text for a fanout_limit result", () => {
    const { container } = render(
      toolResultMessage({ ok: false, error: "fanout_limit", message: "Copilot can propose at most 20 changes per turn; ask again for the rest." }),
    );

    expect(container.textContent).toContain("at most 20 changes per turn");
  });

  it("undoes a low-risk write through undoCopilotWrite and then shows 'Undone'", async () => {
    undoCopilotWrite.mockResolvedValue({ ok: true });
    const { container, props } = render(
      toolResultMessage({ ok: true, data: { artifactId: "art-1", undo: { tool: "save_artifact", id: "art-1" } }, automationsSkipped: [] }, "save_artifact"),
    );

    await act(async () => buttonByText(container, "Undo").click());

    expect(undoCopilotWrite).toHaveBeenCalledWith({ tool: "save_artifact", id: "art-1" });
    expect(props.onUndo).toHaveBeenCalledWith({ tool: "save_artifact", id: "art-1" });
    expect(container.textContent).toContain("Undone");
    expect(Array.from(container.querySelectorAll("button")).some((b) => b.textContent?.trim() === "Undo")).toBe(false);
  });

  it("keeps the Undo button and reports failure when the undo is refused", async () => {
    undoCopilotWrite.mockResolvedValue({ ok: false });
    const { container, props } = render(
      toolResultMessage({ ok: true, data: { undo: { tool: "save_memory", id: "mem-1" } } }, "save_memory"),
    );

    await act(async () => buttonByText(container, "Undo").click());

    expect(container.textContent).toContain("Could not undo");
    expect(container.textContent).not.toContain("Undone");
    expect(props.onUndo).not.toHaveBeenCalled();
  });

  it("renders text parts and a persisted notice, but not the raw diff data part", () => {
    const { container } = render({
      id: "m4",
      role: "assistant",
      parts: [
        { type: "data-notice", data: { code: "no_tools" } },
        { type: "data-approval-diff", id: "x", data: updateDiff },
        { type: "text", text: "Here is what I found." },
      ],
    } as unknown as UIMessage);

    expect(container.textContent).toContain("Here is what I found.");
    expect(container.textContent).toContain("cannot take actions");
    expect(container.textContent).not.toContain("cold");
  });
});
