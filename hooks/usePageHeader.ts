"use client";

import { useEffect, ReactNode } from "react";
import { useHeader } from "@/components/layout/HeaderContext";

interface PageHeaderOptions {
  backHref?: string;
  actions?: ReactNode;
}

export function usePageHeader({ backHref, actions }: PageHeaderOptions) {
  const { setConfig, resetConfig } = useHeader();

  useEffect(() => {
    setConfig({ backHref, actions });

    // Reset when the page unmounts
    return () => resetConfig();
  }, [backHref, actions, setConfig, resetConfig]);
}
