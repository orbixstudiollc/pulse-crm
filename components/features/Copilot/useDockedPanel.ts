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

type DockState = { open: boolean; width: number };

const SERVER_STATE: DockState = { open: false, width: DOCK_DEFAULT_WIDTH };
let state: DockState | null = null;
const listeners = new Set<() => void>();

export function clampDockWidth(width: number): number {
  if (!Number.isFinite(width)) return DOCK_DEFAULT_WIDTH;
  return Math.round(Math.min(DOCK_MAX_WIDTH, Math.max(DOCK_MIN_WIDTH, width)));
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

export function useDockedPanel() {
  const pathname = usePathname();
  const { open, width } = useSyncExternalStore(subscribe, getState, () => SERVER_STATE);

  const toggle = useCallback(() => setState({ ...getState(), open: !getState().open }), []);
  const setWidth = useCallback((next: number) => {
    const clamped = clampDockWidth(next);
    setState({ ...getState(), width: clamped });
    try {
      window.localStorage.setItem(DOCK_WIDTH_KEY, String(clamped));
    } catch {
      // Storage blocked; the width still applies for this session.
    }
  }, []);

  return { isDockedRoute: isDockedPath(pathname ?? ""), open, width, toggle, setWidth };
}
