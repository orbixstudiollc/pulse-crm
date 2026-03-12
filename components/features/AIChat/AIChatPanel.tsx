"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useAIChat } from "./AIChatProvider";
import { AIChatMessages } from "./AIChatMessages";
import { AIChatInput } from "./AIChatInput";
import {
  SparkleIcon,
  XIcon,
  ArrowUpRightIcon,
  ArrowDownIcon,
} from "@/components/ui/Icons";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import type { PageContext } from "@/lib/ai/types";

const PAGE_MAP: Record<string, string> = {
  "/dashboard/overview": "Overview",
  "/dashboard/customers": "Customers",
  "/dashboard/leads": "Leads",
  "/dashboard/icp": "ICP Profiles",
  "/dashboard/sequences": "Sequences",
  "/dashboard/contacts": "Contacts",
  "/dashboard/sales": "Deals",
  "/dashboard/activity": "Activity",
  "/dashboard/analytics": "Analytics",
  "/dashboard/proposals": "Proposals",
  "/dashboard/playbook": "Playbook",
  "/dashboard/competitors": "Competitors",
  "/dashboard/settings": "Settings",
  "/dashboard/templates": "Templates",
};

function autoDetectPageContext(pathname: string): PageContext {
  if (PAGE_MAP[pathname]) return { page: PAGE_MAP[pathname] };
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "dashboard" && segments.length >= 3) {
    const section = segments[1];
    const entityId = segments[2];
    const isUUID = /^[0-9a-f-]{36}$/i.test(entityId);
    const entityMap: Record<string, { page: string; entityType: PageContext["entityType"] }> = {
      leads: { page: "Lead Detail", entityType: "lead" },
      customers: { page: "Customer Detail", entityType: "customer" },
      sales: { page: "Deal Detail", entityType: "deal" },
      competitors: { page: "Competitor Detail", entityType: "competitor" },
      sequences: { page: "Sequence Detail", entityType: "sequence" },
      icp: { page: "ICP Profile Detail", entityType: "icp" },
    };
    if (isUUID && entityMap[section]) {
      return { page: entityMap[section].page, entityType: entityMap[section].entityType, entityId };
    }
  }
  const section = segments[1];
  return { page: PAGE_MAP[`/dashboard/${section}`] || "Dashboard" };
}

export function AIChatPanel() {
  const {
    isOpen,
    isExpanded,
    pageContext,
    toggleChat,
    closeChat,
    expandChat,
    collapseChat,
    setPageContext,
  } = useAIChat();

  // Auto-detect page context from URL on navigation
  const pathname = usePathname();
  useEffect(() => {
    const ctx = autoDetectPageContext(pathname);
    setPageContext(ctx);
  }, [pathname, setPageContext]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        body: { data: { pageContext } },
      }),
    [pageContext]
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Keyboard shortcuts: Cmd+J / Ctrl+J to toggle, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        toggleChat();
      }
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        closeChat();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleChat, closeChat, isOpen]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;
    await sendMessage({ text });
  };

  return (
    <>
      {/* FAB Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleChat}
            className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-neutral-950 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 shadow-lg shadow-neutral-950/25 flex items-center justify-center transition-colors"
            title="Open Pulse AI (Ctrl+J)"
          >
            <SparkleIcon className="w-5 h-5 text-white dark:text-neutral-950" weight="fill" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={`fixed z-50 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden ${
              isExpanded
                ? "bottom-4 right-4 w-[600px] h-[80vh]"
                : "bottom-6 right-6 w-[380px] h-[520px]"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
                  <SparkleIcon className="w-4 h-4 text-neutral-950 dark:text-neutral-50" weight="fill" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    Pulse AI
                  </h3>
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                    {pageContext.entityName
                      ? `${pageContext.entityType ? pageContext.entityType.charAt(0).toUpperCase() + pageContext.entityType.slice(1) : ''}: ${pageContext.entityName}`
                      : pageContext.page} &bull; Ready
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={() => setMessages([])}
                    className="w-7 h-7 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center transition-colors"
                    title="Clear chat"
                  >
                    <span className="text-xs text-neutral-500">Clear</span>
                  </button>
                )}
                <button
                  onClick={isExpanded ? collapseChat : expandChat}
                  className="w-7 h-7 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center transition-colors"
                  title={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? (
                    <ArrowDownIcon className="w-3.5 h-3.5 text-neutral-500" />
                  ) : (
                    <ArrowUpRightIcon className="w-3.5 h-3.5 text-neutral-500" />
                  )}
                </button>
                <button
                  onClick={closeChat}
                  className="w-7 h-7 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center transition-colors"
                  title="Close (Esc)"
                >
                  <XIcon className="w-3.5 h-3.5 text-neutral-500" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <AIChatMessages
              messages={messages}
              isLoading={isLoading}
              pageContext={pageContext}
              onSuggestionClick={handleSend}
            />

            {/* Input */}
            <AIChatInput
              onSend={handleSend}
              isLoading={isLoading}
              contextLabel={
                pageContext.entityName
                  ? `${pageContext.entityType}: ${pageContext.entityName}`
                  : pageContext.page
              }
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
