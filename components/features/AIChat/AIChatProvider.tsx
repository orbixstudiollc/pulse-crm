"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { PageContext } from "@/lib/ai/types";

interface AIChatContextType {
  isOpen: boolean;
  isExpanded: boolean;
  pageContext: PageContext;
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  expandChat: () => void;
  collapseChat: () => void;
  setPageContext: (context: PageContext) => void;
}

const AIChatContext = createContext<AIChatContextType | null>(null);

export function useAIChat() {
  const context = useContext(AIChatContext);
  if (!context) throw new Error("useAIChat must be used within AIChatProvider");
  return context;
}

export function AIChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [pageContext, setPageContext] = useState<PageContext>({
    page: "Overview",
  });

  const toggleChat = useCallback(() => setIsOpen((prev) => !prev), []);
  const openChat = useCallback(() => setIsOpen(true), []);
  const closeChat = useCallback(() => {
    setIsOpen(false);
    setIsExpanded(false);
  }, []);
  const expandChat = useCallback(() => setIsExpanded(true), []);
  const collapseChat = useCallback(() => setIsExpanded(false), []);

  return (
    <AIChatContext.Provider
      value={{
        isOpen,
        isExpanded,
        pageContext,
        toggleChat,
        openChat,
        closeChat,
        expandChat,
        collapseChat,
        setPageContext,
      }}
    >
      {children}
    </AIChatContext.Provider>
  );
}
