"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { PaperPlaneTiltIcon } from "@/components/ui/Icons";

interface AIChatInputProps {
  onSend: (text: string) => void;
  isLoading: boolean;
  contextLabel?: string;
}

export function AIChatInput({
  onSend,
  isLoading,
  contextLabel,
}: AIChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSend(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        onSend(input.trim());
        setInput("");
      }
    }
  };

  return (
    <div className="border-t border-neutral-200 dark:border-neutral-700 p-3">
      {contextLabel && (
        <div className="mb-2 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
            Context: {contextLabel}
          </span>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Pulse AI..."
          rows={1}
          className="flex-1 resize-none bg-neutral-100 dark:bg-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 max-h-[120px]"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="shrink-0 w-8 h-8 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 flex items-center justify-center transition-colors"
        >
          <PaperPlaneTiltIcon className="w-4 h-4 text-white" />
        </button>
      </form>
      <p className="mt-1.5 text-[10px] text-neutral-400 dark:text-neutral-500 text-center">
        Pulse AI can make mistakes. Verify important info.
      </p>
    </div>
  );
}
