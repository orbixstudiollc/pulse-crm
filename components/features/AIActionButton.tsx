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
      "bg-inverse hover:opacity-90 text-on-inverse",
    secondary:
      "bg-muted hover:bg-active text-fg border border-line",
    ghost:
      "hover:bg-muted text-fg-secondary",
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
