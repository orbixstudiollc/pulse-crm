"use client";

import { useAIChat } from "./AIChatProvider";
import {
  SparkleIcon,
  XIcon,
  ArrowUpRightIcon,
  ArrowDownIcon,
} from "@/components/ui/Icons";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { resolvePage } from "@/lib/ai/page-map";
import { startersFor } from "@/lib/ai/page-starters";
import { PageCopilotChat, usePageChatContext } from "@/components/features/Copilot/DockedCopilot";
import { useDockedPanel } from "@/components/features/Copilot/useDockedPanel";

// Floating Copilot button and panel. On docked routes (Leads, Deals, Inbox) the
// button and Ctrl/Cmd+J toggle the docked column instead, and this panel renders
// no chat of its own, so a route never holds two chats.

const COPILOT_PAGE = "/dashboard/copilot";

// Checks the route itself: AnimatePresence keeps an exiting panel mounted, and its
// chat must still unmount at once when the route becomes a docked one or Copilot's
// own page (which has a chat of its own).
function FloatingChat() {
  const { isDockedRoute } = useDockedPanel();
  const pathname = usePathname() ?? "";
  const { pageKey, context, selectionCount } = usePageChatContext();
  const starters = useMemo(() => startersFor(pageKey, { count: selectionCount }), [pageKey, selectionCount]);
  if (isDockedRoute || pathname.startsWith(COPILOT_PAGE)) return null;
  return <PageCopilotChat pageKey={pageKey} context={context} starters={starters} />;
}

export function AIChatPanel() {
  const {
    isOpen,
    isExpanded,
    toggleChat,
    closeChat,
    expandChat,
    collapseChat,
  } = useAIChat();
  const { isDockedRoute, open: isDockOpen, toggle: toggleDock } = useDockedPanel();
  const pathname = usePathname() ?? "";
  const { label } = resolvePage(pathname);
  const isCopilotPage = pathname.startsWith(COPILOT_PAGE);
  const showFloating = isOpen && !isDockedRoute && !isCopilotPage;
  const showButton = !isCopilotPage && (isDockedRoute ? !isDockOpen : !isOpen);

  // Keyboard shortcuts: Cmd+J / Ctrl+J to toggle, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        if (isCopilotPage) return;
        e.preventDefault();
        if (isDockedRoute) toggleDock();
        else toggleChat();
      }
      if (e.key === "Escape" && showFloating) {
        e.preventDefault();
        closeChat();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleChat, closeChat, toggleDock, isDockedRoute, isCopilotPage, showFloating]);

  return (
    <>
      {/* FAB Button */}
      <AnimatePresence>
        {showButton && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={isDockedRoute ? toggleDock : toggleChat}
            className="fixed bottom-6 right-6 z-30 w-12 h-12 rounded-full bg-inverse hover:opacity-90 flex items-center justify-center transition-opacity"
            title="Open Pulse AI (Ctrl+J)"
            aria-label="Open Copilot"
          >
            <SparkleIcon className="w-5 h-5 text-on-inverse" weight="fill" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {showFloating && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            data-clay-box className={`fixed z-50 bg-surface border border-line rounded-lg shadow-modal flex flex-col overflow-hidden ${
              isExpanded
                ? "bottom-4 right-4 w-[600px] h-[80vh]"
                : "bottom-6 right-6 w-[380px] h-[520px]"
            } max-sm:inset-x-2 max-sm:w-auto`}
          >
            {/* Header */}
            <div className="flex h-12 shrink-0 items-center justify-between px-3 border-b border-divider">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center">
                  <SparkleIcon className="w-4 h-4 text-fg" weight="fill" />
                </div>
                <div>
                  <h3 className="text-heading-sm text-fg">
                    Pulse AI
                  </h3>
                  <p className="text-xs text-fg-secondary">
                    {label} &bull; Ready
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={isExpanded ? collapseChat : expandChat}
                  className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
                  title={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? (
                    <ArrowDownIcon className="w-3.5 h-3.5 text-fg-secondary" />
                  ) : (
                    <ArrowUpRightIcon className="w-3.5 h-3.5 text-fg-secondary" />
                  )}
                </button>
                <button
                  onClick={closeChat}
                  className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
                  title="Close (Esc)"
                >
                  <XIcon className="w-3.5 h-3.5 text-fg-secondary" />
                </button>
              </div>
            </div>

            <FloatingChat />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
