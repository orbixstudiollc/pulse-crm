"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { SparkleIcon, UserIcon } from "@/components/ui/Icons";
import { getSuggestionsForContext } from "@/lib/ai/suggestions";
import type { PageContext } from "@/lib/ai/types";

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

interface ToolPart {
  type: string;
  toolName: string;
  toolCallId: string;
  state: string;
  output?: unknown;
  input?: unknown;
}

function getToolParts(message: UIMessage): ToolPart[] {
  return message.parts.filter(
    (part) =>
      part.type === "dynamic-tool" ||
      (typeof part.type === "string" && part.type.startsWith("tool-"))
  ) as unknown as ToolPart[];
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
      return (
        <em key={i} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="px-1 py-0.5 rounded-sm bg-code text-xs font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(<br key={`br-${lineIdx}`} />);
      return;
    }

    // Headers
    if (trimmed.startsWith("### ")) {
      elements.push(
        <p key={lineIdx} className="font-semibold text-sm mt-2 mb-1">
          {renderInline(trimmed.slice(4))}
        </p>
      );
      return;
    }
    if (trimmed.startsWith("## ")) {
      elements.push(
        <p key={lineIdx} className="font-semibold text-sm mt-2 mb-1">
          {renderInline(trimmed.slice(3))}
        </p>
      );
      return;
    }

    // Bullet points
    if (trimmed.startsWith("- ")) {
      elements.push(
        <div key={lineIdx} className="flex gap-2 pl-1 my-0.5">
          <span className="text-fg-muted shrink-0 mt-0.5">•</span>
          <span>{renderInline(trimmed.slice(2))}</span>
        </div>
      );
      return;
    }

    // Numbered list
    const numMatch = trimmed.match(/^(\d+)\.\s/);
    if (numMatch) {
      elements.push(
        <div key={lineIdx} className="flex gap-2 pl-1 my-0.5">
          <span className="text-fg-muted shrink-0 mt-0.5 text-xs w-4 text-right">
            {numMatch[1]}.
          </span>
          <span>{renderInline(trimmed.slice(numMatch[0].length))}</span>
        </div>
      );
      return;
    }

    // Regular paragraph
    elements.push(
      <span key={lineIdx}>
        {renderInline(trimmed)}
        {lineIdx < lines.length - 1 ? " " : ""}
      </span>
    );
  });

  return elements;
}

function getToolLoadingMessage(toolName: string): string {
  const messages: Record<string, string> = {
    lookupLead: "Searching leads...",
    lookupDeal: "Finding deal details...",
    lookupCustomer: "Looking up customer...",
    lookupContact: "Searching contacts...",
    lookupCompetitor: "Analyzing competitor...",
    getPipelineSummary: "Analyzing pipeline...",
    searchDeals: "Searching deals...",
    getLeadScore: "Calculating lead score...",
    getAnalyticsSummary: "Crunching analytics...",
    createNewDeal: "Creating deal...",
    logDealActivity: "Logging activity...",
    addDealNote: "Adding note...",
  };
  return (
    messages[toolName] ||
    `Processing ${toolName.replace(/([A-Z])/g, " $1").toLowerCase()}...`
  );
}

function ToolResultCard({ toolName, result }: { toolName: string; result: string }) {
  const lines = result.split("\n").filter(Boolean);
  const title = lines[0]?.replace(/^\*\*|\*\*$/g, "") || toolName;

  return (
    <div className="my-1.5 rounded-md border border-line bg-surface p-2.5 text-xs">
      <div className="font-semibold text-fg mb-1.5 text-xs">
        {title}
      </div>
      <div className="space-y-0.5 text-fg-secondary">
        {lines.slice(1).map((line, i) => {
          if (line.startsWith("- ")) {
            return (
              <div key={i} className="flex gap-1.5 pl-1">
                <span className="text-fg-muted shrink-0">•</span>
                <span>{line.slice(2)}</span>
              </div>
            );
          }
          if (line.includes(":") && !line.startsWith("http")) {
            const [key, ...rest] = line.split(":");
            const val = rest.join(":").trim();
            return (
              <div key={i} className="flex justify-between gap-2">
                <span className="text-fg-secondary shrink-0">{key}:</span>
                <span className="text-fg font-medium text-right">
                  {val}
                </span>
              </div>
            );
          }
          if (line.trim()) {
            return (
              <div key={i} className="text-fg">
                {line}
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

interface AIChatMessagesProps {
  messages: UIMessage[];
  isLoading: boolean;
  pageContext?: PageContext;
  onSuggestionClick?: (text: string) => void;
}

export function AIChatMessages({
  messages,
  isLoading,
  pageContext,
  onSuggestionClick,
}: AIChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const suggestions = getSuggestionsForContext(pageContext);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 rounded-md bg-accent-surface flex items-center justify-center mb-4">
          <SparkleIcon className="w-5 h-5 text-accent-on-surface" />
        </div>
        <h3 className="text-heading-md text-fg mb-1">
          Pulse AI Copilot
        </h3>
        <p className="text-xs text-fg-secondary max-w-[260px] mb-1">
          Your intelligent sales assistant. Ask anything about your pipeline,
          leads, or deals.
        </p>
        <p className="text-xs text-fg-muted mb-5">
          Press{" "}
          <kbd className="px-1 py-0.5 rounded-sm bg-code text-xs font-mono">
            /
          </kbd>{" "}
          for quick commands
        </p>
        <div className="space-y-2 w-full">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => onSuggestionClick?.(suggestion)}
              className="w-full flex items-center gap-2.5 text-left text-xs px-3 py-2 rounded-md border border-line text-fg-secondary hover:bg-muted hover:text-fg transition-colors"
            >
              <SparkleIcon className="w-3.5 h-3.5 text-fg-muted shrink-0" />
              <span>{suggestion}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => {
        const text = getMessageText(message);
        const toolParts = getToolParts(message);
        if (!text && message.role !== "assistant" && toolParts.length === 0)
          return null;

        return (
          <div
            key={message.id}
            className={`flex gap-2 ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {message.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                <SparkleIcon className="w-3.5 h-3.5 text-fg" />
              </div>
            )}
            <div
              className={`max-w-[80%] ${
                message.role === "user"
                  ? "rounded-lg px-3 py-2 text-sm bg-accent-surface text-fg"
                  : ""
              }`}
            >
              {/* Tool results */}
              {toolParts.length > 0 && (
                <div className="space-y-1">
                  {toolParts.map((tp) => {
                    if (
                      tp.state === "output-available" &&
                      typeof tp.output === "string"
                    ) {
                      return (
                        <ToolResultCard
                          key={tp.toolCallId}
                          toolName={tp.toolName}
                          result={tp.output}
                        />
                      );
                    }
                    if (
                      tp.state === "input-available" ||
                      tp.state === "input-streaming"
                    ) {
                      return (
                        <div
                          key={tp.toolCallId}
                          className="my-1 flex items-center gap-2 text-xs text-fg-secondary"
                        >
                          <div className="w-3 h-3 border border-fg-muted border-t-transparent rounded-full animate-spin" />
                          {getToolLoadingMessage(tp.toolName)}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
              {/* Text content */}
              {text && message.role === "assistant" && (
                <div className="rounded-lg px-3 py-2 text-sm bg-muted text-fg">
                  <div className="whitespace-pre-wrap break-words leading-relaxed">
                    {renderMarkdown(text)}
                  </div>
                </div>
              )}
              {text && message.role === "user" && (
                <div className="whitespace-pre-wrap break-words leading-relaxed">
                  {text}
                </div>
              )}
            </div>
            {message.role === "user" && (
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                <UserIcon className="w-3.5 h-3.5 text-fg-secondary" />
              </div>
            )}
          </div>
        );
      })}

      {isLoading && (
        <div className="flex gap-2 justify-start">
          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
            <SparkleIcon className="w-3.5 h-3.5 text-fg animate-pulse" />
          </div>
          <div className="bg-muted rounded-lg px-3 py-2">
            <div className="flex space-x-1">
              <div
                className="w-2 h-2 bg-fg-muted rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <div
                className="w-2 h-2 bg-fg-muted rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <div
                className="w-2 h-2 bg-fg-muted rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
