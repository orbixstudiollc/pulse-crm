// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { AssistantBrief } from "@/lib/actions/copilot-brief";
import { AssistantHome } from "@/components/features/Copilot/AssistantHome";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

const ZERO: AssistantBrief = { followupsDueToday: 0, overdueFollowups: 0, hotLeadsUntouched: 0, staleDeals: 0, pendingApprovals: 0 };

function render(brief: AssistantBrief | null) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const onPick = vi.fn();
  act(() => root!.render(createElement(AssistantHome, { brief, onPick })));
  return { container, onPick };
}

/** The Today rows (buttons and links), by their text. */
const todayRows = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("section:first-of-type li")).map((li) => li.textContent?.trim());

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.trim() === text);
  if (!found) throw new Error(`no button "${text}"`);
  return found;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

describe("AssistantHome", () => {
  it("shows only the non-zero counts, with a plain label", () => {
    const { container } = render({ ...ZERO, followupsDueToday: 3, staleDeals: 1 });

    expect(todayRows(container)).toEqual(["3 follow-ups due today", "1 deal with no update in 2 weeks"]);
    expect(container.textContent).not.toContain("all caught up");
  });

  it("shows at most four cards", () => {
    const { container } = render({ followupsDueToday: 1, overdueFollowups: 2, hotLeadsUntouched: 3, staleDeals: 4, pendingApprovals: 5 });

    expect(todayRows(container)).toHaveLength(4);
  });

  it("all-zero counts show You're all caught up with a single Plan my day card", () => {
    const { container, onPick } = render(ZERO);

    expect(container.textContent).toContain("You're all caught up");
    expect(todayRows(container)).toEqual(["Plan my day"]);
    act(() => container.querySelector<HTMLButtonElement>("section:first-of-type li button")!.click());
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0][0]).toMatch(/^Plan my day/);
  });

  it("a missing brief does not claim the user is caught up", () => {
    const { container } = render(null);

    expect(container.textContent).not.toContain("all caught up");
    expect(todayRows(container)).toEqual(["Plan my day"]);
  });

  it("clicking a card sends its prompt", () => {
    const { container, onPick } = render({ ...ZERO, followupsDueToday: 3 });

    act(() => buttonByText(container, "3 follow-ups due today").click());

    expect(onPick).toHaveBeenCalledWith("Show the follow-ups due today and help me work through them one by one.");
  });

  it("the pending approvals card links to the approvals view instead of sending a prompt", () => {
    const { container, onPick } = render({ ...ZERO, pendingApprovals: 2 });

    const link = container.querySelector<HTMLAnchorElement>("section:first-of-type li a");
    expect(link?.textContent).toBe("2 changes waiting for your approval");
    expect(link?.getAttribute("href")).toBe("/dashboard/copilot?view=approvals");
    expect(onPick).not.toHaveBeenCalled();
  });

  it("groups quick actions as Leads, Deals, Outreach and Insights, and a click sends the prompt", () => {
    const { container, onPick } = render(ZERO);

    const text = container.textContent ?? "";
    for (const group of ["Leads", "Deals", "Outreach", "Insights"]) expect(text).toContain(group);
    act(() => buttonByText(container, "Who should I call today?").click());
    expect(onPick).toHaveBeenCalledWith(expect.stringMatching(/^Who should I call today\?/));
  });
});
