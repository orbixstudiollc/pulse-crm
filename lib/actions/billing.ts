"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "./helpers";

// ── Plan tier definitions ────────────────────────────────────────────────────

export type PlanId = "free" | "starter" | "pro" | "enterprise";

interface PlanTier {
  id: PlanId;
  name: string;
  label: string;
  price: number;
  limits: {
    leads: number;       // -1 = unlimited
    members: number;
    sequences: number;
    customers: number;
  };
}

const PLAN_TIERS: Record<PlanId, PlanTier> = {
  free: {
    id: "free",
    name: "Free",
    label: "Free Plan",
    price: 0,
    limits: { leads: 1000, members: 2, sequences: 5, customers: 500 },
  },
  starter: {
    id: "starter",
    name: "Starter",
    label: "Starter Plan",
    price: 19,
    limits: { leads: 10000, members: 5, sequences: 20, customers: 5000 },
  },
  pro: {
    id: "pro",
    name: "Professional",
    label: "Pro Plan",
    price: 49,
    limits: { leads: 100000, members: 25, sequences: 100, customers: 50000 },
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    label: "Enterprise Plan",
    price: 149,
    limits: { leads: -1, members: -1, sequences: -1, customers: -1 },
  },
};

// ── Billing data types ───────────────────────────────────────────────────────

export interface BillingData {
  plan: PlanTier;
  usage: {
    leads: { used: number; limit: number };
    members: { used: number; limit: number };
    sequences: { used: number; limit: number };
    customers: { used: number; limit: number };
  };
  nextBillingDate: string | null;
  orgCreatedAt: string | null;
}

// ── Get billing data ─────────────────────────────────────────────────────────

export async function getBillingData(): Promise<{ data?: BillingData; error?: string }> {
  try {
    const { profile } = await getCurrentUserProfile();
    const orgId = profile.organization_id;
    if (!orgId) return { error: "No organization found" };

    const supabase = await createClient();

    // Run all counts in parallel
    const [leadsRes, membersRes, sequencesRes, customersRes, orgRes] = await Promise.all([
      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId),
      supabase
        .from("sequences")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId),
      supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId),
      supabase
        .from("organizations")
        .select("created_at")
        .eq("id", orgId)
        .single(),
    ]);

    const leadCount = leadsRes.count ?? 0;
    const memberCount = membersRes.count ?? 0;
    const sequenceCount = sequencesRes.count ?? 0;
    const customerCount = customersRes.count ?? 0;
    const orgCreatedAt = orgRes.data?.created_at ?? null;

    // Determine plan — default to pro for now (could be stored in org table later)
    const planId: PlanId = "pro";
    const plan = PLAN_TIERS[planId];

    // Calculate next billing date (monthly from org creation)
    let nextBillingDate: string | null = null;
    if (orgCreatedAt) {
      const created = new Date(orgCreatedAt);
      const now = new Date();
      const next = new Date(created);
      // Advance month by month until it's in the future
      while (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
      nextBillingDate = next.toISOString();
    }

    return {
      data: {
        plan,
        usage: {
          leads: { used: leadCount, limit: plan.limits.leads },
          members: { used: memberCount, limit: plan.limits.members },
          sequences: { used: sequenceCount, limit: plan.limits.sequences },
          customers: { used: customerCount, limit: plan.limits.customers },
        },
        nextBillingDate,
        orgCreatedAt,
      },
    };
  } catch (err) {
    console.error("[Billing] Error:", err);
    return { error: "Failed to load billing data" };
  }
}

