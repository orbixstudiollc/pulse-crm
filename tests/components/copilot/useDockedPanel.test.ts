// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

// ---- mocks: the layout's server-only and chrome dependencies ----

// A subscribable pathname, like the router context next/navigation reads: a route
// change re-renders every usePathname caller, including frozen (exiting) subtrees.
const nav = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  return {
    pathname: "/dashboard/overview",
    listeners,
    set(pathname: string) {
      this.pathname = pathname;
      listeners.forEach((listener) => listener());
    },
  };
});
vi.mock("next/navigation", async () => {
  const React = await import("react");
  const subscribe = (listener: () => void) => {
    nav.listeners.add(listener);
    return () => void nav.listeners.delete(listener);
  };
  return {
    usePathname: () => React.useSyncExternalStore(subscribe, () => nav.pathname),
    redirect: (url: string) => {
      throw new Error(`redirect ${url}`);
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: { id: "user-1", organization_id: "org-1" } }) }),
      }),
    }),
  }),
}));

const passthrough = ({ children }: { children?: ReactNode }) => children;
vi.mock("@/components/layout", () => ({ Header: () => null, Sidebar: () => null, MobileSidebar: () => null }));
vi.mock("@/components/layout/HeaderContext", () => ({ HeaderProvider: passthrough }));
vi.mock("@/components/layout/SidebarContext", () => ({ SidebarProvider: passthrough }));
vi.mock("@/components/providers/AuthProvider", () => ({ AuthProvider: passthrough }));
vi.mock("@/components/lead-finder/EnrichmentProgressBanner", () => ({ EnrichmentProgressBanner: () => null }));
vi.mock("@/components/features/ThemeProvider", () => ({ ThemedToaster: () => null }));

const CONV_ID = "22222222-2222-4222-8222-222222222222";
vi.mock("@/lib/actions/copilot-conversations", () => ({
  getPageConversation: async () => ({ id: CONV_ID, messages: [] }),
  listConversationMessages: async () => [],
}));

// The chat hook is replaced by a stub that tracks every mounted instance, so the
// tests count live chats directly instead of inferring them from markup.
type ChatArgs = { pageKey?: string; context?: { selectedIds?: string[] } };
const chats = vi.hoisted(() => ({ live: new Map<string, unknown>(), overrides: {} as Record<string, unknown> }));
vi.mock("@/components/features/Copilot/useCopilotChat", async (importOriginal) => {
  const React = await import("react");
  const actual = await importOriginal<typeof import("@/components/features/Copilot/useCopilotChat")>();
  return {
    ...actual,
    useCopilotChat: (args: ChatArgs) => {
      const id = React.useId();
      chats.live.set(id, args);
      React.useEffect(() => () => void chats.live.delete(id), [id]);
      return {
        messages: [],
        status: "ready",
        error: undefined,
        sendText: () => undefined,
        approve: () => undefined,
        deny: () => undefined,
        conversationId: CONV_ID,
        notice: null,
        stop: () => undefined,
        reloadFromServer: async () => undefined,
        ...chats.overrides,
      };
    },
  };
});

// ---- modules under test, re-imported per test so the dock store starts fresh ----

type ReactModule = typeof import("react");
type DockModule = typeof import("@/components/features/Copilot/useDockedPanel");
type SelectionModule = typeof import("@/components/features/Copilot/SelectionContext");
type Layout = (typeof import("@/app/dashboard/layout"))["default"];

let React: ReactModule;
let createRoot: (typeof import("react-dom/client"))["createRoot"];
let dock: DockModule;
let selection: SelectionModule;
let DashboardLayout: Layout;
let root: import("react-dom/client").Root | null = null;
let container: HTMLDivElement;

const LEAD_ID = "33333333-3333-4333-8333-333333333333";

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
}

beforeEach(async () => {
  vi.resetModules();
  window.localStorage.clear();
  chats.live.clear();
  chats.overrides = {};
  setViewportWidth(1440);
  nav.listeners.clear();
  React = await import("react");
  ({ createRoot } = await import("react-dom/client"));
  dock = await import("@/components/features/Copilot/useDockedPanel");
  selection = await import("@/components/features/Copilot/SelectionContext");
  DashboardLayout = (await import("@/app/dashboard/layout")).default;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  React.act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

async function renderLayout(pathname: string, page: ReactNode = null) {
  nav.pathname = pathname;
  const tree = await DashboardLayout({ children: page });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await React.act(async () => root!.render(tree));
}

async function rerenderLayout(pathname: string, page: ReactNode = null) {
  const tree = await DashboardLayout({ children: page });
  await React.act(async () => {
    nav.set(pathname);
    root!.render(tree);
  });
}

async function pressCtrlJ() {
  await React.act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "j", ctrlKey: true }));
  });
}

const chatViews = () => container.querySelectorAll("[data-copilot-chat]");
const dockColumn = () => container.querySelector('aside[aria-label="Copilot"]');

type HookResult = ReturnType<DockModule["useDockedPanel"]>;
async function renderHook(pathname: string): Promise<{ current: HookResult }> {
  nav.pathname = pathname;
  const result = { current: null as unknown as HookResult };
  function Harness() {
    result.current = dock.useDockedPanel();
    return null;
  }
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await React.act(async () => root!.render(React.createElement(Harness)));
  return result;
}

describe("useDockedPanel: docked routes", () => {
  it.each([
    "/dashboard/leads",
    `/dashboard/leads/${LEAD_ID}`,
    "/dashboard/sales",
    `/dashboard/sales/${LEAD_ID}`,
    "/dashboard/inbox",
    `/dashboard/inbox/${LEAD_ID}`,
  ])("docks on %s", async (pathname) => {
    const hook = await renderHook(pathname);
    expect(hook.current.isDockedRoute).toBe(true);
  });

  it.each([
    "/dashboard/overview",
    "/dashboard/customers",
    `/dashboard/customers/${LEAD_ID}`,
    "/dashboard/competitors",
    "/dashboard/copilot",
    "/dashboard/settings",
    "/login",
  ])("does not dock on %s", async (pathname) => {
    const hook = await renderHook(pathname);
    expect(hook.current.isDockedRoute).toBe(false);
  });

  it("docks only on the lead, deal and inbox page keys", () => {
    expect([...dock.DOCKED_PAGE_KEYS].sort()).toEqual(["deal_detail", "deals", "inbox", "lead_detail", "leads"]);
  });
});

describe("useDockedPanel: width", () => {
  it("caps the dock at min(640, viewport - 480 - 240 sidebar from lg)", () => {
    expect(dock.maxDockWidth(1440)).toBe(640);
    expect(dock.maxDockWidth(1280)).toBe(560);
    expect(dock.maxDockWidth(1024)).toBe(304);
    expect(dock.maxDockWidth(1023)).toBe(543); // below lg there is no sidebar column
    expect(dock.maxDockWidth(800)).toBe(320);
    expect(dock.maxDockWidth(600)).toBe(dock.DOCK_MIN_WIDTH); // never below the minimum
    expect(dock.maxDockWidth(undefined)).toBe(640);
    expect(dock.clampDockWidth(600, 1024)).toBe(304);
    expect(dock.clampDockWidth(300, 1024)).toBe(300);
    expect(dock.clampDockWidth(100, 1024)).toBe(280);
  });

  it("clamps the stored width to the current viewport and follows window resizes", async () => {
    setViewportWidth(1280);
    const hook = await renderHook("/dashboard/leads");
    await React.act(async () => hook.current.setWidth(9999));
    expect(hook.current.width).toBe(560);
    expect(hook.current.maxWidth).toBe(560);

    await React.act(async () => {
      setViewportWidth(1100);
      window.dispatchEvent(new Event("resize"));
    });
    expect(hook.current.width).toBe(380);
    expect(hook.current.maxWidth).toBe(380);
  });

  it("does not store the width when persist is false", async () => {
    const hook = await renderHook("/dashboard/leads");
    await React.act(async () => hook.current.setWidth(500, { persist: false }));
    expect(hook.current.width).toBe(500);
    expect(window.localStorage.getItem("copilot.dock.width")).toBeNull();
  });

  it("clamps widths to 280..640", () => {
    expect(dock.clampDockWidth(100)).toBe(280);
    expect(dock.clampDockWidth(279)).toBe(280);
    expect(dock.clampDockWidth(452)).toBe(452);
    expect(dock.clampDockWidth(641)).toBe(640);
    expect(dock.clampDockWidth(5000)).toBe(640);
    expect(dock.clampDockWidth(Number.NaN)).toBe(dock.DOCK_DEFAULT_WIDTH);
  });

  it("setWidth clamps the value and stores it under copilot.dock.width", async () => {
    const hook = await renderHook("/dashboard/leads");
    await React.act(async () => hook.current.setWidth(10));
    expect(hook.current.width).toBe(280);
    expect(window.localStorage.getItem("copilot.dock.width")).toBe("280");

    await React.act(async () => hook.current.setWidth(9999));
    expect(hook.current.width).toBe(640);
    expect(window.localStorage.getItem("copilot.dock.width")).toBe("640");

    await React.act(async () => hook.current.setWidth(500));
    expect(hook.current.width).toBe(500);
  });

  it("reads the stored width back, clamped", async () => {
    window.localStorage.setItem("copilot.dock.width", "9000");
    const hook = await renderHook("/dashboard/leads");
    expect(hook.current.width).toBe(640);
  });

  it("toggle opens and closes the dock", async () => {
    const hook = await renderHook("/dashboard/leads");
    expect(hook.current.open).toBe(false);
    await React.act(async () => hook.current.toggle());
    expect(hook.current.open).toBe(true);
    await React.act(async () => hook.current.toggle());
    expect(hook.current.open).toBe(false);
  });
});

describe("dock resize handle", () => {
  const handle = () => container.querySelector<HTMLElement>('[role="separator"]')!;
  const pointer = (type: string, clientX: number) =>
    new PointerEvent(type, { bubbles: true, cancelable: true, clientX, pointerId: 1 });

  async function openDock() {
    await renderLayout("/dashboard/leads");
    await pressCtrlJ();
  }

  it("describes its range and the column it controls", async () => {
    await openDock();

    expect(handle().getAttribute("aria-valuemin")).toBe("280");
    expect(handle().getAttribute("aria-valuemax")).toBe("640");
    expect(handle().getAttribute("aria-valuenow")).toBe(String(dock.DOCK_DEFAULT_WIDTH));
    expect(handle().getAttribute("aria-controls")).toBe(dockColumn()!.id);
    expect(dockColumn()!.id).not.toBe("");
    expect(handle().className).toContain("touch-none");
    expect(handle().className).toContain("focus-visible:ring-2");
  });

  it("jumps to the minimum and maximum width with Home and End", async () => {
    await openDock();

    await React.act(async () => {
      handle().dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    });
    expect(handle().getAttribute("aria-valuenow")).toBe("640");
    await React.act(async () => {
      handle().dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    });
    expect(handle().getAttribute("aria-valuenow")).toBe("280");
    expect(window.localStorage.getItem("copilot.dock.width")).toBe("280");
  });

  it("stores the width only when the drag ends", async () => {
    await openDock();

    await React.act(async () => {
      handle().dispatchEvent(pointer("pointerdown", 1000));
      handle().dispatchEvent(pointer("pointermove", 900));
    });
    expect(handle().getAttribute("aria-valuenow")).toBe("480");
    expect(window.localStorage.getItem("copilot.dock.width")).toBeNull();

    await React.act(async () => {
      handle().dispatchEvent(pointer("pointermove", 880));
      handle().dispatchEvent(pointer("pointerup", 880));
    });
    expect(handle().getAttribute("aria-valuenow")).toBe("500");
    expect(window.localStorage.getItem("copilot.dock.width")).toBe("500");

    // After the drag, stray moves do nothing.
    await React.act(async () => {
      handle().dispatchEvent(pointer("pointermove", 500));
    });
    expect(handle().getAttribute("aria-valuenow")).toBe("500");
  });

  it("restores the starting width, unsaved, when the drag is cancelled", async () => {
    await openDock();

    await React.act(async () => {
      handle().dispatchEvent(pointer("pointerdown", 1000));
      handle().dispatchEvent(pointer("pointermove", 900));
      handle().dispatchEvent(pointer("pointercancel", 900));
    });
    expect(handle().getAttribute("aria-valuenow")).toBe(String(dock.DOCK_DEFAULT_WIDTH));
    expect(window.localStorage.getItem("copilot.dock.width")).toBeNull();
  });

  it("pads the content only from lg up, so below lg the dock overlays it", async () => {
    await openDock();
    const padded = container.querySelector<HTMLElement>("[style*='--copilot-dock-width']")!;
    expect(padded.className).toContain("lg:pr-(--copilot-dock-width)");
    expect(padded.className).not.toContain("md:pr-");
  });
});

describe("docked chat composer", () => {
  it("blocks new text while approval cards wait, with a hint", async () => {
    chats.overrides = { awaitingApproval: true };
    await renderLayout("/dashboard/leads");
    await pressCtrlJ();

    expect(container.textContent).toContain("Answer the pending changes first");
    const send = container.querySelector<HTMLButtonElement>('button[aria-label="Send"]')!;
    expect(send.disabled).toBe(true);
    const textarea = container.querySelector("textarea")!;
    expect(textarea.getAttribute("maxlength")).toBe("8000");
    const hint = document.getElementById(textarea.getAttribute("aria-describedby")!);
    expect(hint?.textContent).toBe("Answer the pending changes first");
  });

  it("shows a server rejection as plain text, not raw JSON", async () => {
    chats.overrides = { status: "error", error: new Error(JSON.stringify({ error: "empty_turn" })) };
    await renderLayout("/dashboard/leads");
    await pressCtrlJ();

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toBe("Copilot could not take that message. Please try again.");
  });
});

describe("dashboard layout mounts exactly one chat", () => {
  it("on a docked route Ctrl+J opens the dock with one ChatView and pads the content", async () => {
    await renderLayout("/dashboard/leads");
    expect(chatViews()).toHaveLength(0);

    await pressCtrlJ();

    expect(dockColumn()).not.toBeNull();
    expect(chatViews()).toHaveLength(1);
    expect(chats.live.size).toBe(1);
    expect(dockColumn()!.contains(chatViews()[0])).toBe(true);
    const padded = container.querySelector<HTMLElement>("[style*='--copilot-dock-width']");
    expect(padded?.style.getPropertyValue("--copilot-dock-width")).toBe(`${dock.DOCK_DEFAULT_WIDTH}px`);
    expect(padded?.contains(container.querySelector("main"))).toBe(true);
    const link = container.querySelector<HTMLAnchorElement>("a[href^='/dashboard/copilot']");
    expect(link?.getAttribute("href")).toBe(`/dashboard/copilot?c=${CONV_ID}`);
  });

  it("on a non-docked route Ctrl+J opens the floating panel with one ChatView", async () => {
    await renderLayout("/dashboard/overview");
    await pressCtrlJ();

    expect(dockColumn()).toBeNull();
    expect(chatViews()).toHaveLength(1);
    expect(chats.live.size).toBe(1);
    expect(container.querySelector("[style*='--copilot-dock-width']")).toBeNull();
  });

  it("never mounts two chats when the floating panel was open before moving to a docked route", async () => {
    await renderLayout("/dashboard/overview");
    await pressCtrlJ(); // floating panel open
    expect(chats.live.size).toBe(1);

    await rerenderLayout("/dashboard/leads");
    expect(chatViews()).toHaveLength(0);
    expect(chats.live.size).toBe(0);

    await pressCtrlJ(); // opens the dock
    expect(chatViews()).toHaveLength(1);
    expect(chats.live.size).toBe(1);
    expect(dockColumn()).not.toBeNull();

    await rerenderLayout("/dashboard/customers");
    expect(dockColumn()).toBeNull();
    expect(chatViews()).toHaveLength(1); // the floating panel is back, alone
    expect(chats.live.size).toBe(1);
  });

  it("unmounts the floating chat at once when moving to Copilot's own page", async () => {
    await renderLayout("/dashboard/overview");
    await pressCtrlJ();
    expect(chats.live.size).toBe(1);

    await rerenderLayout("/dashboard/copilot");
    expect(chatViews()).toHaveLength(0);
    expect(chats.live.size).toBe(0);
  });

  it("fits the floating panel to a phone's width", async () => {
    await renderLayout("/dashboard/overview");
    await pressCtrlJ();

    const panel = chatViews()[0].closest<HTMLElement>(".fixed")!;
    expect(panel.className).toContain("max-sm:inset-x-2");
    expect(panel.className).toContain("max-sm:w-auto");
  });

  it("passes the page's selected ids to the docked chat and shows the selection starters", async () => {
    function LeadsPage() {
      selection.useProvideSelection([LEAD_ID]);
      return null;
    }
    await renderLayout("/dashboard/leads", React.createElement(LeadsPage));
    await pressCtrlJ();

    const [args] = [...chats.live.values()] as ChatArgs[];
    expect(args.pageKey).toBe("leads");
    expect(args.context?.selectedIds).toEqual([LEAD_ID]);
    expect(container.textContent).toContain("Score these");
  });
});
