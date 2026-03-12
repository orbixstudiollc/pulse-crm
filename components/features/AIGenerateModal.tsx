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
            className="fixed inset-0 z-50 bg-black/50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700 flex flex-col max-h-[80vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <SparkleIcon className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {title}
                  </h3>
                  {description && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {description}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center transition-colors"
              >
                <XIcon className="w-4 h-4 text-neutral-500" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {!content && !isGenerating && !error && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-4">
                    <SparkleIcon className="w-6 h-6 text-violet-600 dark:text-violet-400" />
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                    Click Generate to create AI-powered content
                  </p>
                  <button
                    onClick={generate}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <SparkleIcon className="w-4 h-4" />
                    Generate
                  </button>
                </div>
              )}

              {isGenerating && (
                <div className="text-center py-12">
                  <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <SparkleIcon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Generating with AI...
                  </p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                    This may take a few seconds
                  </p>
                </div>
              )}

              {error && (
                <div className="text-center py-8">
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {error}
                    </p>
                  </div>
                  <button
                    onClick={generate}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors"
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
                      className="w-full min-h-[200px] bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-y"
                    />
                  ) : (
                    <div className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
                      <div className="text-sm text-neutral-900 dark:text-neutral-100 whitespace-pre-wrap">
                        {content}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {content && !isGenerating && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                <div className="flex items-center gap-2">
                  <button
                    onClick={generate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                  >
                    <ArrowPathIcon className="w-3.5 h-3.5" />
                    Regenerate
                  </button>
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                  >
                    <CopyIcon className="w-3.5 h-3.5" />
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  {onApply && (
                    <button
                      onClick={handleApply}
                      disabled={isApplied}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
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
