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

type Props = { message: UIMessage; isLatest: boolean; onApprove: Mock; onDeny: Mock; onUndo: Mock };

function render(message: UIMessage, overrides: Partial<{ isLatest: boolean }> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const props: Props = { message, isLatest: true, onApprove: vi.fn(), onDeny: vi.fn(), onUndo: vi.fn(), ...overrides };
  act(() => root!.render(createElement(ChatMessageParts, props)));
  const rerender = (next: Partial<Props>) => act(() => root!.render(createElement(ChatMessageParts, { ...props, ...next })));
  return { container, props, rerender };
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
    expect(container.textContent).toContain("Details unavailable; ask again");
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

  it("enables both buttons while requested and locks them with aria-disabled once approval-responded", () => {
    const requested = render(approvalMessage({ state: "approval-requested", descriptor: updateDiff }));
    expect(buttonByText(requested.container, "Approve").disabled).toBe(false);
    expect(buttonByText(requested.container, "Deny").disabled).toBe(false);
    expect(buttonByText(requested.container, "Approve").getAttribute("aria-disabled")).toBeNull();
    act(() => root!.unmount());
    document.body.innerHTML = "";

    const responded = render(approvalMessage({ state: "approval-responded", descriptor: updateDiff }));
    const approve = buttonByText(responded.container, "Approve");
    const deny = buttonByText(responded.container, "Deny");
    expect(approve.getAttribute("aria-disabled")).toBe("true");
    expect(deny.getAttribute("aria-disabled")).toBe("true");
    act(() => approve.click());
    act(() => deny.click());
    expect(responded.props.onApprove).not.toHaveBeenCalled();
    expect(responded.props.onDeny).not.toHaveBeenCalled();
    expect(responded.container.querySelector("[role=status]")?.textContent).toBe("Approved");
  });

  it("keeps focus on the pressed button after the answer is recorded", () => {
    const { container, rerender } = render(approvalMessage({ state: "approval-requested", descriptor: updateDiff }));
    const approve = buttonByText(container, "Approve");
    approve.focus();
    act(() => approve.click());

    rerender({ message: approvalMessage({ state: "approval-responded", descriptor: updateDiff }) });

    expect(buttonByText(container, "Approve")).toBe(approve);
    expect(approve.disabled).toBe(false);
    expect(document.activeElement).toBe(approve);
  });

  it("points both buttons at the card title and announces the status in a live region", () => {
    const { container } = render(approvalMessage({ state: "approval-requested", descriptor: updateDiff }));

    const title = container.querySelector("h3")!;
    expect(title.id).not.toBe("");
    expect(title.textContent).toBe("Updated lead");
    expect(buttonByText(container, "Approve").getAttribute("aria-describedby")).toBe(title.id);
    expect(buttonByText(container, "Deny").getAttribute("aria-describedby")).toBe(title.id);
    expect(container.querySelector("[role=status]")?.textContent).toBe("Approval needed");
  });

  it("expires the cards of a message that is not the latest: disabled buttons and 'Expired, ask again'", () => {
    for (const state of ["approval-requested", "approval-responded"] as const) {
      const { container, props } = render(approvalMessage({ state, descriptor: updateDiff }), { isLatest: false });

      expect(container.querySelector("[role=status]")?.textContent).toBe("Expired, ask again");
      expect(container.textContent).not.toContain("Approved");
      const approve = buttonByText(container, "Approve");
      const deny = buttonByText(container, "Deny");
      expect(approve.disabled).toBe(true);
      expect(deny.disabled).toBe(true);
      act(() => approve.click());
      act(() => deny.click());
      expect(props.onApprove).not.toHaveBeenCalled();
      expect(props.onDeny).not.toHaveBeenCalled();

      act(() => root!.unmount());
      document.body.innerHTML = "";
    }
  });

  it("disables Approve but keeps Deny when no diff is available", () => {
    const { container, props } = render(approvalMessage({ state: "approval-requested" }));

    expect(container.textContent).toContain("Details unavailable; ask again");
    const approve = buttonByText(container, "Approve");
    const deny = buttonByText(container, "Deny");
    expect(approve.disabled).toBe(true);
    expect(deny.disabled).toBe(false);
    act(() => approve.click());
    expect(props.onApprove).not.toHaveBeenCalled();
    act(() => deny.click());
    expect(props.onDeny).toHaveBeenCalledWith("appr-1", undefined);
  });

  it("treats a diff with no fields as unavailable", () => {
    const { container } = render(approvalMessage({ state: "approval-requested", descriptor: { ...updateDiff, fields: [] } }));

    expect(container.textContent).toContain("Details unavailable; ask again");
    expect(buttonByText(container, "Approve").disabled).toBe(true);
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
    expect(rows).toEqual(["Done: Searched leads", "Done: brand_new_tool"]);
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

  it("gives each step status a text alternative and hides the icon from screen readers", () => {
    const { container } = render({
      id: "m5",
      role: "assistant",
      parts: [
        { type: "tool-update_lead", toolCallId: "a", state: "input-available", input: {} },
        { type: "tool-update_lead", toolCallId: "b", state: "output-error", input: {}, errorText: "boom" },
        { type: "tool-update_lead", toolCallId: "c", state: "output-available", input: {}, output: { ok: false, error: "record_changed" } },
      ],
    } as unknown as UIMessage);

    const statuses = Array.from(container.querySelectorAll("li .sr-only")).map((n) => n.textContent);
    expect(statuses).toEqual(["Running: ", "Failed: ", "Out of date: "]);
    const icons = Array.from(container.querySelectorAll("li svg"));
    expect(icons).toHaveLength(3);
    expect(icons.every((svg) => svg.getAttribute("aria-hidden") === "true")).toBe(true);
  });

  it("keeps a step group's Undone state when text streams in after it", async () => {
    undoCopilotWrite.mockResolvedValue({ ok: true });
    const stepPart = {
      type: "tool-save_artifact",
      toolCallId: "call-9",
      state: "output-available",
      input: {},
      output: { ok: true, data: { undo: { tool: "save_artifact", id: "art-9" } } },
    };
    const { container, rerender } = render({ id: "m6", role: "assistant", parts: [stepPart] } as unknown as UIMessage);
    await act(async () => buttonByText(container, "Undo").click());
    expect(container.textContent).toContain("Undone");

    rerender({
      message: {
        id: "m6",
        role: "assistant",
        parts: [{ type: "step-start" }, stepPart, { type: "text", text: "Saved it." }],
      } as unknown as UIMessage,
    });

    expect(container.textContent).toContain("Saved it.");
    expect(container.textContent).toContain("Undone");
    expect(Array.from(container.querySelectorAll("button")).some((b) => b.textContent?.trim() === "Undo")).toBe(false);
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
