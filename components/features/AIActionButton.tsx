"use client";

import { SparkleIcon, CircleNotchIcon } from "@/components/ui/Icons";

interface AIActionButtonProps {
  onClick: () => void;
  loading?: boolean;
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  disabled?: boolean;
}

export function AIActionButton({
  onClick,
  loading = false,
  label,
  size = "sm",
  variant = "ghost",
  className = "",
  disabled = false,
}: AIActionButtonProps) {
  const hasLabel = !!label;

  // Icon-only uses fixed size; with label uses padding
  const sizeClasses = hasLabel
    ? {
        sm: "h-7 px-2.5 text-xs",
        md: "h-8 px-3 text-xs",
        lg: "h-9 px-4 text-sm",
      }
    : {
        sm: "w-7 h-7 text-xs",
        md: "w-8 h-8 text-xs",
        lg: "w-9 h-9 text-sm",
      };

  const variantClasses = {
    primary:
      "bg-neutral-900 dark:bg-neutral-100 hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-neutral-900",
    secondary:
      "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700",
    ghost:
      "hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400",
  };

  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      title={label || "AI Action"}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium leading-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      {loading ? (
        <CircleNotchIcon className="w-3 h-3 animate-spin flex-shrink-0" />
      ) : (
        <SparkleIcon className="w-3 h-3 flex-shrink-0" />
      )}
      {label && <span className="whitespace-nowrap">{label}</span>}
    </button>
  );
}
