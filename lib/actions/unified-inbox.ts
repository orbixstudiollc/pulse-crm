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

  // Fetch from all channels in parallel
  const [emailRes, directEmailRes, waRes, liRes] = await Promise.all([
    // Email events from sequence_events
    filters?.channel && filters.channel !== "email"
      ? Promise.resolve({ data: [] })
      : supabase
          .from("sequence_events")
          .select(
            `id, event_type, created_at, metadata,
             sequence_enrollments(
               id, lead_id,
               leads(id, name, email, company, organization_id)
             )`
          )
          .in("event_type", [
            "email_sent",
            "email_opened",
            "email_clicked",
            "email_replied",
            "email_bounced",
          ])
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1),

    // Direct email messages (composed from inbox)
    filters?.channel && filters.channel !== "email"
      ? Promise.resolve({ data: [] })
      : supabase
          .from("email_messages")
          .select(
            `id, direction, subject, body_text, status, from_address, to_addresses, sent_at, created_at,
             email_threads(
               id, subject, lead_id,
               leads(id, name, email, company)
             )`
          )
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1),

    // WhatsApp messages
    filters?.channel && filters.channel !== "whatsapp"
      ? Promise.resolve({ data: [] })
      : supabase
          .from("whatsapp_messages")
          .select(
            `id, direction, message_type, body_text, status, created_at,
             leads(id, name, email, company, phone)`
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
             leads(id, name, email, company, linkedin)`
          )
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1),
  ]);

  // Safely extract data, log errors
  const emailData = (emailRes as { data: unknown[] | null; error?: { message: string } | null }).data || [];
  const directEmailData = (directEmailRes as { data: unknown[] | null; error?: { message: string } | null }).data || [];
  const waData = (waRes as { data: unknown[] | null; error?: { message: string } | null }).data || [];
  const liData = (liRes as { data: unknown[] | null; error?: { message: string } | null }).data || [];

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

  // Email events (from sequences)
  if (emailData.length > 0) {
    for (const ev of emailData as unknown[]) {
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
            organization_id: string;
          } | null;
        } | null;
      };
      // Filter by org since we removed the nested .eq filter
      const lead = e.sequence_enrollments?.leads;
      if (lead && lead.organization_id !== orgId) continue;
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
        lead: lead || {
          id: "",
          name: null,
          email: null,
          company: null,
          avatar_url: null,
        },
      });
    }
  }

  // Direct email messages (composed from inbox)
  if (directEmailData.length > 0) {
    for (const dm of directEmailData as unknown[]) {
      const msg = dm as {
        id: string;
        direction: string;
        subject: string | null;
        body_text: string | null;
        status: string;
        from_address: string | null;
        to_addresses: string[] | null;
        sent_at: string | null;
        created_at: string;
        email_threads: {
          id: string;
          subject: string | null;
          lead_id: string | null;
          leads: {
            id: string;
            name: string | null;
            email: string | null;
            company: string | null;
            avatar_url: string | null;
          } | null;
        };
      };
      // Skip if already represented by a sequence event (avoid duplicates)
      const toAddr = msg.to_addresses?.[0] || "";
      items.push({
        id: msg.id,
        channel: "email",
        type: msg.direction === "inbound" ? "email_received" : "email_sent",
        preview: msg.subject || msg.body_text?.slice(0, 80) || "No subject",
        status: msg.status,
        direction: msg.direction === "inbound" ? "inbound" : "outbound",
        created_at: msg.sent_at || msg.created_at,
        lead: msg.email_threads?.leads || {
          id: "",
          name: toAddr || msg.from_address,
          email: msg.direction === "inbound" ? msg.from_address : toAddr,
          company: null,
          avatar_url: null,
        },
      });
    }
  }

  // WhatsApp messages
  if (waData.length > 0) {
    for (const m of waData as unknown[]) {
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
  if (liData.length > 0) {
    for (const a of liData as unknown[]) {
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
// Delete Unified Inbox Item
// ============================================================

export async function deleteUnifiedItem(id: string, channel: "email" | "whatsapp" | "linkedin", type?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile?.organization_id) return { error: "No organization" };

  const orgId = profile.organization_id;

  if (channel === "email") {
    if (type && type.startsWith("email_") && type !== "email_sent" && type !== "email_received") {
      // Sequence event
      await supabase.from("sequence_events").delete().eq("id", id);
    } else {
      // Direct email message — delete message, then thread if empty
      const { data: msg } = await supabase
        .from("email_messages")
        .select("thread_id")
        .eq("id", id)
        .eq("organization_id", orgId)
        .single();

      await supabase.from("email_messages").delete().eq("id", id).eq("organization_id", orgId);

      if (msg?.thread_id) {
        const { count } = await supabase
          .from("email_messages")
          .select("id", { count: "exact", head: true })
          .eq("thread_id", msg.thread_id);
        if (count === 0) {
          await supabase.from("email_threads").delete().eq("id", msg.thread_id).eq("organization_id", orgId);
        }
      }
    }
  } else if (channel === "whatsapp") {
    await supabase.from("whatsapp_messages").delete().eq("id", id).eq("organization_id", orgId);
  } else if (channel === "linkedin") {
    await supabase.from("linkedin_actions").delete().eq("id", id).eq("organization_id", orgId);
  }

  return { success: true };
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
