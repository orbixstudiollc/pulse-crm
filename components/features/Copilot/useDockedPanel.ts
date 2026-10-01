"use client";

// Open/width state of the docked Copilot column. The state lives in one module-level
// store so the floating button, the dock and the padded content column all see it.

import { useCallback, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { resolvePage } from "@/lib/ai/page-map";

export const DOCKED_PAGE_KEYS = ["leads", "lead_detail", "deals", "deal_detail", "inbox"];
export const DOCK_MIN_WIDTH = 280;
export const DOCK_MAX_WIDTH = 640;
export const DOCK_DEFAULT_WIDTH = 380;
export const DOCK_WIDTH_KEY = "copilot.dock.width";
/** Below this viewport width (Tailwind lg) the dock overlays the content instead of pushing it. */
export const DOCK_OVERLAY_BELOW = 1024;
/** Content width the dock always leaves visible, and the sidebar's width from lg up. */
const MIN_CONTENT_WIDTH = 480;
const SIDEBAR_WIDTH = 240;

type DockState = { open: boolean; width: number };

const SERVER_STATE: DockState = { open: false, width: DOCK_DEFAULT_WIDTH };
let state: DockState | null = null;
const listeners = new Set<() => void>();

/** The widest the dock may be in a viewport this wide (no viewport: the fixed maximum). */
export function maxDockWidth(viewportWidth?: number | null): number {
  if (viewportWidth == null) return DOCK_MAX_WIDTH;
  const sidebar = viewportWidth >= DOCK_OVERLAY_BELOW ? SIDEBAR_WIDTH : 0;
  return Math.max(DOCK_MIN_WIDTH, Math.min(DOCK_MAX_WIDTH, viewportWidth - MIN_CONTENT_WIDTH - sidebar));
}

export function clampDockWidth(width: number, viewportWidth?: number | null): number {
  if (!Number.isFinite(width)) return DOCK_DEFAULT_WIDTH;
  return Math.round(Math.min(maxDockWidth(viewportWidth), Math.max(DOCK_MIN_WIDTH, width)));
}

export function isDockedPath(pathname: string): boolean {
  return DOCKED_PAGE_KEYS.includes(resolvePage(pathname).pageKey);
}

function readStoredWidth(): number {
  try {
    const raw = window.localStorage.getItem(DOCK_WIDTH_KEY);
    return raw === null ? DOCK_DEFAULT_WIDTH : clampDockWidth(Number(raw));
  } catch {
    return DOCK_DEFAULT_WIDTH; // Storage blocked (private mode); the default width still works.
  }
}

function getState(): DockState {
  if (!state) state = { open: false, width: readStoredWidth() };
  return state;
}

function setState(next: DockState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function subscribeViewport(listener: () => void) {
  window.addEventListener("resize", listener);
  return () => window.removeEventListener("resize", listener);
}
const getViewportWidth = () => window.innerWidth;
const getServerViewportWidth = () => null;

export function useDockedPanel() {
  const pathname = usePathname();
  const { open, width: storedWidth } = useSyncExternalStore(subscribe, getState, () => SERVER_STATE);
  const viewportWidth = useSyncExternalStore(subscribeViewport, getViewportWidth, getServerViewportWidth);

  const toggle = useCallback(() => setState({ ...getState(), open: !getState().open }), []);
  /** Sets the width, clamped to the viewport; `persist: false` skips storage (mid-drag). */
  const setWidth = useCallback((next: number, { persist = true }: { persist?: boolean } = {}) => {
    const clamped = clampDockWidth(next, window.innerWidth);
    setState({ ...getState(), width: clamped });
    if (!persist) return;
    try {
      window.localStorage.setItem(DOCK_WIDTH_KEY, String(clamped));
    } catch {
      // Storage blocked; the width still applies for this session.
    }
  }, []);

  return {
    isDockedRoute: isDockedPath(pathname ?? ""),
    open,
    width: clampDockWidth(storedWidth, viewportWidth),
    minWidth: DOCK_MIN_WIDTH,
    maxWidth: maxDockWidth(viewportWidth),
    toggle,
    setWidth,
  };
}
