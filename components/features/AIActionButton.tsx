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
  const sizeClasses = {
    sm: "w-7 h-7 text-xs",
    md: "h-8 px-3 text-xs",
    lg: "h-9 px-4 text-sm",
  };

  const variantClasses = {
    primary:
      "bg-violet-600 hover:bg-violet-700 text-white shadow-sm",
    secondary:
      "bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/30 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800",
    ghost:
      "hover:bg-violet-50 dark:hover:bg-violet-900/20 text-violet-600 dark:text-violet-400",
  };

  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      title={label || "AI Action"}
      className={`inline-flex items-center justify-center gap-1.5 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      {loading ? (
        <CircleNotchIcon className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <SparkleIcon className="w-3.5 h-3.5" />
      )}
      {label && <span>{label}</span>}
    </button>
  );
}
