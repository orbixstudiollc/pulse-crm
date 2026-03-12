"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { SparkleIcon, UserIcon } from "@/components/ui/Icons";

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

interface AIChatMessagesProps {
  messages: UIMessage[];
  isLoading: boolean;
}

export function AIChatMessages({ messages, isLoading }: AIChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mb-4">
          <SparkleIcon className="w-6 h-6 text-violet-600 dark:text-violet-400" />
        </div>
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
          Pulse AI Assistant
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-[240px]">
          Ask me anything about your CRM data. I can help with lead scoring, email drafting, meeting prep, and more.
        </p>
        <div className="mt-4 space-y-2 w-full">
          {[
            "Summarize my pipeline",
            "Score my top leads",
            "Draft an email to...",
            "Prepare for my next meeting",
          ].map((suggestion) => (
            <button
              key={suggestion}
              className="w-full text-left text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              {suggestion}
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
        if (!text && message.role !== "assistant") return null;

        return (
          <div
            key={message.id}
            className={`flex gap-2 ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {message.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0 mt-1">
                <SparkleIcon className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                message.role === "user"
                  ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              }`}
            >
              <div className="whitespace-pre-wrap break-words leading-relaxed">
                {text}
              </div>
            </div>
            {message.role === "user" && (
              <div className="w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center shrink-0 mt-1">
                <UserIcon className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
              </div>
            )}
          </div>
        );
      })}

      {isLoading && (
        <div className="flex gap-2 justify-start">
          <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
            <SparkleIcon className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 animate-pulse" />
          </div>
          <div className="bg-neutral-100 dark:bg-neutral-800 rounded-xl px-3 py-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
