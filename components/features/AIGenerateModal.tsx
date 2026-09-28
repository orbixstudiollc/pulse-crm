"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  SparkleIcon,
  XIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  CopyIcon,
} from "@/components/ui/Icons";

interface AIGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  onGenerate: () => Promise<string>;
  onApply?: (content: string) => void;
  applyLabel?: string;
  editable?: boolean;
}

export function AIGenerateModal({
  isOpen,
  onClose,
  title,
  description,
  onGenerate,
  onApply,
  applyLabel = "Apply",
  editable = true,
}: AIGenerateModalProps) {
  const [content, setContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isApplied, setIsApplied] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setIsApplied(false);
    try {
      const result = await onGenerate();
      setContent(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  }, [onGenerate]);

  const handleApply = () => {
    if (onApply && content) {
      onApply(content);
      setIsApplied(true);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setContent("");
    setError(null);
    setIsApplied(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-black/40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-2xl bg-surface rounded-lg border border-line shadow-modal flex flex-col max-h-[80vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-divider">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-accent-surface flex items-center justify-center">
                  <SparkleIcon className="w-4 h-4 text-accent-strong" />
                </div>
                <div>
                  <h3 className="text-heading-md text-fg">
                    {title}
                  </h3>
                  {description && (
                    <p className="text-xs text-fg-secondary mt-0.5">
                      {description}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
              >
                <XIcon className="w-4 h-4 text-fg-secondary" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {!content && !isGenerating && !error && (
                <div className="text-center py-8">
                  <div className="w-10 h-10 rounded-full bg-accent-surface flex items-center justify-center mx-auto mb-4">
                    <SparkleIcon className="w-5 h-5 text-accent-strong" />
                  </div>
                  <p className="text-sm text-fg-secondary mb-4">
                    Click Generate to create AI-powered content
                  </p>
                  <button
                    onClick={generate}
                    className="inline-flex h-8 items-center gap-2 px-3 bg-accent-strong hover:opacity-90 text-on-inverse text-sm font-medium rounded-md transition-opacity"
                  >
                    <SparkleIcon className="w-4 h-4" />
                    Generate
                  </button>
                </div>
              )}

              {isGenerating && (
                <div className="text-center py-12">
                  <div className="w-10 h-10 rounded-full bg-accent-surface flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <SparkleIcon className="w-5 h-5 text-accent-strong" />
                  </div>
                  <p className="text-sm text-fg-secondary">
                    Generating with AI...
                  </p>
                  <p className="text-xs text-fg-muted mt-1">
                    This may take a few seconds
                  </p>
                </div>
              )}

              {error && (
                <div className="text-center py-8">
                  <div className="bg-danger-surface rounded-md p-4 mb-4">
                    <p className="text-sm text-danger">
                      {error}
                    </p>
                  </div>
                  <button
                    onClick={generate}
                    className="inline-flex h-8 items-center gap-2 px-3 bg-accent-strong hover:opacity-90 text-on-inverse text-sm font-medium rounded-md transition-opacity"
                  >
                    <ArrowPathIcon className="w-4 h-4" />
                    Retry
                  </button>
                </div>
              )}

              {content && !isGenerating && (
                <div>
                  {editable ? (
                    <textarea
                      value={content}
                      onChange={(e) => {
                        setContent(e.target.value);
                        setIsApplied(false);
                      }}
                      className="w-full min-h-[200px] bg-surface border border-line rounded-md p-3 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent resize-y"
                    />
                  ) : (
                    <div className="bg-subtle border border-line rounded-md p-4">
                      <div className="text-sm text-fg whitespace-pre-wrap">
                        {content}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {content && !isGenerating && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-divider bg-subtle">
                <div className="flex items-center gap-2">
                  <button
                    onClick={generate}
                    className="inline-flex h-8 items-center gap-1.5 px-3 text-sm font-medium text-fg bg-surface border border-line rounded-md hover:bg-muted transition-colors"
                  >
                    <ArrowPathIcon className="w-3.5 h-3.5" />
                    Regenerate
                  </button>
                  <button
                    onClick={handleCopy}
                    className="inline-flex h-8 items-center gap-1.5 px-3 text-sm font-medium text-fg bg-surface border border-line rounded-md hover:bg-muted transition-colors"
                  >
                    <CopyIcon className="w-3.5 h-3.5" />
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClose}
                    className="h-8 px-3 text-sm font-medium text-fg-secondary hover:bg-muted hover:text-fg rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  {onApply && (
                    <button
                      onClick={handleApply}
                      disabled={isApplied}
                      className="inline-flex h-8 items-center gap-1.5 px-3 bg-accent-strong hover:opacity-90 disabled:bg-success-fill text-on-inverse text-sm font-medium rounded-md transition-colors"
                    >
                      {isApplied ? (
                        <>
                          <CheckCircleIcon className="w-4 h-4" />
                          Applied
                        </>
                      ) : (
                        applyLabel
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
