"use client";

import { useState, KeyboardEvent } from "react";
import { XIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

interface TagInputProps {
  label?: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function TagInput({
  label,
  tags,
  onChange,
  placeholder = "Add a tag...",
  className,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      if (!tags.includes(inputValue.trim())) {
        onChange([...tags, inputValue.trim()]);
      }
      setInputValue("");
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter((tag) => tag !== tagToRemove));
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-fg mb-1.5">
          {label}
        </label>
      )}
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 min-h-8 px-2 py-1 rounded-md border border-line bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30 transition-colors duration-150",
        )}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-subtle text-[12px] font-medium text-fg"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-fg-secondary hover:text-fg"
            >
              <XIcon size={12} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] h-6 px-1 bg-transparent text-sm text-fg placeholder:text-fg-muted outline-none"
        />
      </div>
      <p className="text-[13px] text-fg-muted mt-1">
        Press Enter to add a tag
      </p>
    </div>
  );
}
