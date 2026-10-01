// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const rows = vi.hoisted(() => ({ list: [] as Array<Record<string, unknown>> }));
vi.mock("@/lib/actions/notifications", () => ({
  listNotifications: async () => rows.list,
  markNotificationRead: async () => ({ success: true }),
  markAllRead: async () => ({ success: true }),
  unreadCount: async () => rows.list.length,
}));

import { NotificationsDropdown, isSafeNotificationLink } from "@/components/features/NotificationsDropdown";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  push.mockReset();
  rows.list = [];
});

function notification(id: string, link: string | null) {
  return { id, kind: "task_result", title: `Note ${id}`, body: null, link, read_at: "2026-10-01T00:00:00Z", created_at: "2026-10-01T00:00:00Z" };
}

async function renderDropdown() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(createElement(NotificationsDropdown)));
  const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Notifications"]')!;
  return { container, trigger };
}

describe("isSafeNotificationLink", () => {
  it("accepts same-site paths only", () => {
    expect(isSafeNotificationLink("/dashboard/copilot?tab=tasks")).toBe(true);
    expect(isSafeNotificationLink("/")).toBe(true);
  });

  it("rejects protocol-relative, backslash, absolute and scheme links", () => {
    for (const link of ["//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)", "dashboard", "", null, undefined]) {
      expect(isSafeNotificationLink(link)).toBe(false);
    }
  });
});

describe("NotificationsDropdown", () => {
  it("navigates for a same-site link and ignores an off-site one", async () => {
    rows.list = [notification("a", "/dashboard/leads"), notification("b", "//evil.example/phish")];
    const { container, trigger } = await renderDropdown();

    await act(async () => trigger.click());
    const items = () => Array.from(container.querySelectorAll<HTMLButtonElement>("li button"));
    await act(async () => items()[1].click());
    expect(push).not.toHaveBeenCalled();

    await act(async () => trigger.click());
    await act(async () => items()[0].click());
    expect(push).toHaveBeenCalledWith("/dashboard/leads");
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("reports its popup state on the trigger and closes on Escape", async () => {
    const { container, trigger } = await renderDropdown();
    expect(trigger.getAttribute("aria-haspopup")).toBe("true");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await act(async () => trigger.click());
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain("Notifications");
    expect(container.querySelector(".max-w-\\[calc\\(100vw-1rem\\)\\]")).not.toBeNull();

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector(".max-w-\\[calc\\(100vw-1rem\\)\\]")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
