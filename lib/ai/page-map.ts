export type PageEntityType = "lead" | "deal" | "customer" | "competitor" | "thread";

export interface PageEntry {
  pageKey: string;
  label: string;
}

export interface ResolvedPage extends PageEntry {
  entityType?: PageEntityType;
  entityId?: string;
}

export const PAGE_MAP: Record<string, PageEntry> = {
  "/dashboard/overview": { pageKey: "overview", label: "Overview" },
  "/dashboard/customers": { pageKey: "customers", label: "Customers" },
  "/dashboard/leads": { pageKey: "leads", label: "Leads" },
  "/dashboard/icp": { pageKey: "icp", label: "ICP Profiles" },
  "/dashboard/sequences": { pageKey: "sequences", label: "Sequences" },
  "/dashboard/contacts": { pageKey: "contacts", label: "Contacts" },
  "/dashboard/sales": { pageKey: "deals", label: "Deals" },
  "/dashboard/inbox": { pageKey: "inbox", label: "Inbox" },
  "/dashboard/activity": { pageKey: "activity", label: "Activity" },
  "/dashboard/analytics": { pageKey: "analytics", label: "Analytics" },
  "/dashboard/proposals": { pageKey: "proposals", label: "Proposals" },
  "/dashboard/playbook": { pageKey: "playbook", label: "Playbook" },
  "/dashboard/competitors": { pageKey: "competitors", label: "Competitors" },
  "/dashboard/settings": { pageKey: "settings", label: "Settings" },
  "/dashboard/templates": { pageKey: "templates", label: "Templates" },
};

const OTHER: PageEntry = { pageKey: "other", label: "Dashboard" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DETAIL_PAGES: Record<string, PageEntry & { entityType: PageEntityType }> = {
  leads: { pageKey: "lead_detail", label: "Lead Detail", entityType: "lead" },
  sales: { pageKey: "deal_detail", label: "Deal Detail", entityType: "deal" },
  customers: { pageKey: "customer_detail", label: "Customer Detail", entityType: "customer" },
  competitors: { pageKey: "competitor_detail", label: "Competitor Detail", entityType: "competitor" },
};

export function resolvePage(pathname: string): ResolvedPage {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const exact = PAGE_MAP[path];
  if (exact) return { ...exact };

  const [root, section, id] = path.split("/").filter(Boolean);
  if (root !== "dashboard" || !section) return { ...OTHER };

  // Inbox threads keep the Inbox page key; the thread id travels as the entity.
  if (section === "inbox" && id && UUID_RE.test(id)) {
    return { ...PAGE_MAP["/dashboard/inbox"], entityType: "thread", entityId: id };
  }

  const detail = DETAIL_PAGES[section];
  if (detail && id && UUID_RE.test(id)) {
    const { entityType, ...entry } = detail;
    return { ...entry, entityType, entityId: id };
  }

  const parent = PAGE_MAP[`/dashboard/${section}`];
  return parent ? { ...parent } : { ...OTHER };
}
