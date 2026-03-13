"use server";

import { createClient } from "@/lib/supabase/server";

// ============================================================
// Get Unified Inbox — All channels, grouped by lead
// ============================================================

export async function getUnifiedInbox(filters?: {
  channel?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { threads: [], error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile?.organization_id)
    return { threads: [], error: "No organization" };

  const orgId = profile.organization_id;
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  // Fetch from all three channels in parallel
  const [emailRes, waRes, liRes] = await Promise.all([
    // Email events from sequence_events
    filters?.channel && filters.channel !== "email"
      ? Promise.resolve({ data: [] })
      : supabase
          .from("sequence_events")
          .select(
            `id, event_type, created_at, metadata,
             sequence_enrollments!inner(
               id, lead_id,
               leads!inner(id, name, email, company, avatar_url)
             )`
          )
          .eq("sequence_enrollments.leads.organization_id", orgId)
          .in("event_type", [
            "email_sent",
            "email_opened",
            "email_clicked",
            "email_replied",
            "email_bounced",
          ])
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1),

    // WhatsApp messages
    filters?.channel && filters.channel !== "whatsapp"
      ? Promise.resolve({ data: [] })
      : supabase
          .from("whatsapp_messages")
          .select(
            `id, direction, message_type, body_text, status, created_at,
             leads!inner(id, name, email, company, avatar_url, phone)`
          )
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1),

    // LinkedIn actions
    filters?.channel && filters.channel !== "linkedin"
      ? Promise.resolve({ data: [] })
      : supabase
          .from("linkedin_actions")
          .select(
            `id, action_type, status, connection_note, message_body, created_at,
             leads!inner(id, name, email, company, avatar_url, linkedin)`
          )
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1),
  ]);

  // Normalize all into a unified thread format
  type UnifiedItem = {
    id: string;
    channel: "email" | "whatsapp" | "linkedin";
    type: string;
    preview: string;
    status: string;
    direction: "outbound" | "inbound";
    created_at: string;
    lead: {
      id: string;
      name: string | null;
      email: string | null;
      company: string | null;
      avatar_url: string | null;
    };
  };

  const items: UnifiedItem[] = [];

  // Email events
  if (emailRes.data) {
    for (const ev of emailRes.data as unknown[]) {
      const e = ev as {
        id: string;
        event_type: string;
        created_at: string;
        metadata: Record<string, unknown> | null;
        sequence_enrollments: {
          id: string;
          lead_id: string;
          leads: {
            id: string;
            name: string | null;
            email: string | null;
            company: string | null;
            avatar_url: string | null;
          };
        };
      };
      items.push({
        id: e.id,
        channel: "email",
        type: e.event_type,
        preview:
          (e.metadata?.subject as string) ||
          e.event_type.replace("email_", "").replace("_", " "),
        status: e.event_type.replace("email_", ""),
        direction: e.event_type === "email_replied" ? "inbound" : "outbound",
        created_at: e.created_at,
        lead: e.sequence_enrollments?.leads || {
          id: "",
          name: null,
          email: null,
          company: null,
          avatar_url: null,
        },
      });
    }
  }

  // WhatsApp messages
  if (waRes.data) {
    for (const m of waRes.data as unknown[]) {
      const msg = m as {
        id: string;
        direction: string;
        message_type: string;
        body_text: string | null;
        status: string;
        created_at: string;
        leads: {
          id: string;
          name: string | null;
          email: string | null;
          company: string | null;
          avatar_url: string | null;
          phone: string | null;
        };
      };
      items.push({
        id: msg.id,
        channel: "whatsapp",
        type: msg.message_type,
        preview: msg.body_text || `[${msg.message_type}]`,
        status: msg.status,
        direction: msg.direction === "inbound" ? "inbound" : "outbound",
        created_at: msg.created_at,
        lead: msg.leads,
      });
    }
  }

  // LinkedIn actions
  if (liRes.data) {
    for (const a of liRes.data as unknown[]) {
      const act = a as {
        id: string;
        action_type: string;
        status: string;
        connection_note: string | null;
        message_body: string | null;
        created_at: string;
        leads: {
          id: string;
          name: string | null;
          email: string | null;
          company: string | null;
          avatar_url: string | null;
          linkedin: string | null;
        };
      };
      items.push({
        id: act.id,
        channel: "linkedin",
        type: act.action_type,
        preview:
          act.message_body ||
          act.connection_note ||
          act.action_type.replace("_", " "),
        status: act.status,
        direction:
          act.status === "replied" ? "inbound" : "outbound",
        created_at: act.created_at,
        lead: act.leads,
      });
    }
  }

  // Sort by created_at desc
  items.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Apply search filter
  let filtered = items;
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    filtered = items.filter(
      (i) =>
        (i.lead.name?.toLowerCase() || "").includes(q) ||
        (i.lead.email?.toLowerCase() || "").includes(q) ||
        (i.lead.company?.toLowerCase() || "").includes(q) ||
        i.preview.toLowerCase().includes(q)
    );
  }

  return { threads: filtered.slice(0, limit), error: null };
}

// ============================================================
// Get Inbox Stats (counts per channel)
// ============================================================

export async function getInboxStats() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { stats: null, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile?.organization_id)
    return { stats: null, error: "No organization" };

  const orgId = profile.organization_id;

  // Get today's date for "today" counts
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const [waCount, liCount] = await Promise.all([
    supabase
      .from("whatsapp_messages")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("created_at", todayISO),
    supabase
      .from("linkedin_actions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("created_at", todayISO),
  ]);

  return {
    stats: {
      whatsapp_today: waCount.count || 0,
      linkedin_today: liCount.count || 0,
    },
    error: null,
  };
}
