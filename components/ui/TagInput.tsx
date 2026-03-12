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
        <label className="block text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-1.5">
          {label}
        </label>
      )}
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 focus-within:border-neutral-200 dark:focus-within:border-neutral-700 focus-within:shadow-focus transition-shadow",
        )}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-sm text-neutral-950 dark:text-neutral-50"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            >
              <XIcon size={14} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-neutral-950 dark:text-neutral-50 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 outline-none"
        />
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">
        Press Enter to add a tag
      </p>
    </div>
  );
}
