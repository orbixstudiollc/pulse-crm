"use client";

// The records selected on the current page (Leads, Deals, Inbox), published by the
// page and read by the docked Copilot, which lives in the dashboard layout.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type SelectionValue = { selectedIds: string[]; setSelectedIds(ids: string[]): void };

const EMPTY: string[] = [];
const SelectionContext = createContext<SelectionValue | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<string[]>(EMPTY);
  const value = useMemo(() => ({ selectedIds, setSelectedIds }), [selectedIds]);
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

/** The ids the current page has selected. */
export function useSelection(): string[] {
  return useContext(SelectionContext)?.selectedIds ?? EMPTY;
}

/** Publishes the page's selected ids for as long as the page is mounted. */
export function useProvideSelection(ids: string[]) {
  const setSelectedIds = useContext(SelectionContext)?.setSelectedIds;
  const key = ids.join(",");
  useEffect(() => {
    if (!setSelectedIds) return;
    setSelectedIds(key ? key.split(",") : EMPTY);
    return () => setSelectedIds(EMPTY);
  }, [setSelectedIds, key]);
}
