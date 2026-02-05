"use client";

import { useEffect, ReactNode } from "react";
import { useHeader } from "@/components/layout/HeaderContext";

interface PageHeaderOptions {
  backHref?: string;
  actions?: ReactNode;
  breadcrumbLabel?: string;
}

export function usePageHeader({
  backHref,
  actions,
  breadcrumbLabel,
}: PageHeaderOptions) {
  const { setConfig, resetConfig } = useHeader();

  useEffect(() => {
    setConfig({ backHref, actions, breadcrumbLabel });
    return () => resetConfig();
  }, [backHref, actions, breadcrumbLabel, setConfig, resetConfig]);
}
