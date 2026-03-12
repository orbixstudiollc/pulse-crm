"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAIChat } from "./AIChatProvider";
import type { PageContext } from "@/lib/ai/types";

const PAGE_MAP: Record<string, string> = {
  "/dashboard/overview": "Overview",
  "/dashboard/customers": "Customers",
  "/dashboard/leads": "Leads",
  "/dashboard/icp": "ICP Profiles",
  "/dashboard/sequences": "Sequences",
  "/dashboard/contacts": "Contacts",
  "/dashboard/sales": "Deals",
  "/dashboard/activity": "Activity",
  "/dashboard/analytics": "Analytics",
  "/dashboard/proposals": "Proposals",
  "/dashboard/playbook": "Playbook",
  "/dashboard/competitors": "Competitors",
  "/dashboard/settings": "Settings",
  "/dashboard/templates": "Templates",
};

function parsePageContext(pathname: string): PageContext {
  // Check exact matches first
  if (PAGE_MAP[pathname]) {
    return { page: PAGE_MAP[pathname] };
  }

  // Check entity detail pages
  const segments = pathname.split("/").filter(Boolean);

  // /dashboard/leads/[id]
  if (segments[0] === "dashboard" && segments.length >= 3) {
    const section = segments[1];
    const entityId = segments[2];

    // Skip non-UUID segments like "add"
    const isUUID = /^[0-9a-f-]{36}$/i.test(entityId);

    if (section === "leads" && isUUID) {
      return {
        page: "Lead Detail",
        entityType: "lead",
        entityId,
      };
    }

    if (section === "customers" && isUUID) {
      return {
        page: "Customer Detail",
        entityType: "customer",
        entityId,
      };
    }

    if (section === "sales" && isUUID) {
      return {
        page: "Deal Detail",
        entityType: "deal",
        entityId,
      };
    }

    if (section === "competitors" && isUUID) {
      return {
        page: "Competitor Detail",
        entityType: "competitor",
        entityId,
      };
    }

    if (section === "sequences" && isUUID) {
      return {
        page: "Sequence Detail",
        entityType: "sequence",
        entityId,
      };
    }

    if (section === "icp" && isUUID) {
      return {
        page: "ICP Profile Detail",
        entityType: "icp",
        entityId,
      };
    }
  }

  // Fallback to section name
  const section = segments[1];
  return {
    page: PAGE_MAP[`/dashboard/${section}`] || "Dashboard",
  };
}

/**
 * Hook that automatically detects the current page context from the URL
 * and updates the AI chat context.
 *
 * Usage: Call this in page client components to set context.
 * Optionally pass entityName for richer context display.
 */
export function usePageContext(entityName?: string) {
  const pathname = usePathname();
  const { setPageContext } = useAIChat();

  useEffect(() => {
    const context = parsePageContext(pathname);
    if (entityName) {
      context.entityName = entityName;
    }
    setPageContext(context);
  }, [pathname, entityName, setPageContext]);
}
