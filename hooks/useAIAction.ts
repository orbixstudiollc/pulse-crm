"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";

interface UseAIActionOptions<T> {
  action: (...args: unknown[]) => Promise<T | { error: string }>;
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
}

interface UseAIActionReturn<T> {
  execute: (...args: unknown[]) => Promise<T | null>;
  data: T | null;
  loading: boolean;
  error: string | null;
  reset: () => void;
}

export function useAIAction<T>({
  action,
  successMessage,
  errorMessage = "AI action failed",
  onSuccess,
  onError,
}: UseAIActionOptions<T>): UseAIActionReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (...args: unknown[]): Promise<T | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await action(...args);
        if (result && typeof result === "object" && "error" in result) {
          const errMsg = (result as { error: string }).error;
          setError(errMsg);
          toast.error(errorMessage, { description: errMsg });
          onError?.(errMsg);
          return null;
        }
        setData(result as T);
        if (successMessage) {
          toast.success(successMessage);
        }
        onSuccess?.(result as T);
        return result as T;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        setError(errMsg);
        toast.error(errorMessage, { description: errMsg });
        onError?.(errMsg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [action, successMessage, errorMessage, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { execute, data, loading, error, reset };
}
