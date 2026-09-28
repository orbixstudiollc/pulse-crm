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

  // Detect slash commands (adjusted during render when input changes, not in an effect)
  const [prevInput, setPrevInput] = useState(input);
  if (input !== prevInput) {
    setPrevInput(input);
    setShowSlashMenu(input.startsWith("/") && !input.includes(" "));
  }

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
    <div className="border-t border-divider p-3">
      {contextLabel && (
        <div className="mb-2 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-inverse" />
          <span className="text-xs text-fg-secondary">
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
          className="flex-1 resize-none bg-surface border border-line rounded-md px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent max-h-[120px]"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="shrink-0 w-8 h-8 rounded-md bg-inverse hover:opacity-90 disabled:opacity-50 flex items-center justify-center transition-opacity"
        >
          <PaperPlaneTiltIcon className="w-4 h-4 text-on-inverse" />
        </button>
      </form>
      <p className="mt-1.5 text-xs text-fg-muted text-center">
        Pulse AI can make mistakes. Verify important info.
      </p>
    </div>
  );
}
