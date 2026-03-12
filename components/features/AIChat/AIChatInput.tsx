"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { PaperPlaneTiltIcon } from "@/components/ui/Icons";
import { SlashCommandMenu } from "./SlashCommandMenu";
import type { SlashCommand } from "@/lib/ai/slash-commands";

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
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    }
  }, [input]);

  // Detect slash commands
  useEffect(() => {
    if (input.startsWith("/") && !input.includes(" ")) {
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSend(input.trim());
      setInput("");
      setShowSlashMenu(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Let the slash command menu handle arrow keys and enter when open
    if (showSlashMenu && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Enter" || e.key === "Escape")) {
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        onSend(input.trim());
        setInput("");
        setShowSlashMenu(false);
      }
    }
  };

  const handleSlashSelect = (command: SlashCommand) => {
    setInput(command.promptTemplate);
    setShowSlashMenu(false);
    // Focus the textarea and place cursor at end
    setTimeout(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = command.promptTemplate.length;
      }
    }, 0);
  };

  return (
    <div className="border-t border-neutral-200 dark:border-neutral-700 p-3">
      {contextLabel && (
        <div className="mb-2 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-950 dark:bg-neutral-50" />
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
            Context: {contextLabel}
          </span>
        </div>
      )}
      <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
        {showSlashMenu && (
          <SlashCommandMenu
            query={input}
            onSelect={handleSlashSelect}
            onClose={() => setShowSlashMenu(false)}
          />
        )}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Ask Pulse AI... (type "/" for commands)'
          rows={1}
          className="flex-1 resize-none bg-neutral-100 dark:bg-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500/50 max-h-[120px]"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="shrink-0 w-8 h-8 rounded bg-neutral-950 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 flex items-center justify-center transition-colors"
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
