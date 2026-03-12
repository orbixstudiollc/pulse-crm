"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId, getCurrentUserProfile } from "./helpers";
import { revalidatePath } from "next/cache";
import type { Database, Json } from "@/types/database";

type ApifyRunInsert = Database["public"]["Tables"]["apify_scraper_runs"]["Insert"];
type ApifyRunRow = Database["public"]["Tables"]["apify_scraper_runs"]["Row"];
type ScrapedLeadInsert = Database["public"]["Tables"]["scraped_leads"]["Insert"];

// ── Actor ID Mapping ──────────────────────────────────────────────────────────

const ACTOR_MAP: Record<string, string> = {
  google_places: "compass/crawler-google-places",
  instagram: "apify/instagram-scraper",
  linkedin: "dev_fusion/linkedin-profile-scraper",
  leads_finder: "code_crafter/leads-finder",
};

const SOURCE_LABELS: Record<string, string> = {
  google_places: "Google Maps",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  leads_finder: "Leads Finder",
};

// ── Get Apify Token ───────────────────────────────────────────────────────────

async function getApifyToken(): Promise<string> {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data: settings } = await supabase
    .from("ai_settings")
    .select("apify_api_key")
    .eq("organization_id", orgId)
    .single();

  const token = settings?.apify_api_key || process.env.APIFY_API_KEY;
  if (!token) {
    throw new Error("No Apify API key configured. Add one in Settings > AI or set APIFY_API_KEY in environment.");
  }
  return token;
}

// ── Start Scrape ──────────────────────────────────────────────────────────────

export async function startApifyScrape(params: {
  source: "google_places" | "instagram" | "linkedin" | "leads_finder";
  input: Record<string, unknown>;
  searchName?: string;
}): Promise<{ data: { runId: string; searchId: string } | null; error?: string }> {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId();
    const { user } = await getCurrentUserProfile();
    const token = await getApifyToken();

    const actorId = ACTOR_MAP[params.source];
    if (!actorId) return { data: null, error: "Invalid source type" };

    // Create saved search record
    const { data: search, error: searchErr } = await supabase
      .from("lead_searches")
      .insert({
        organization_id: orgId,
        created_by: user.id,
        name: params.searchName || `${SOURCE_LABELS[params.source]} Search`,
        filters: params.input as unknown as Json,
        result_count: 0,
      })
      .select()
      .single();

    if (searchErr) return { data: null, error: searchErr.message };

    // Create run record
    const { data: run, error: runErr } = await supabase
      .from("apify_scraper_runs")
      .insert({
        organization_id: orgId,
        search_id: search.id,
        created_by: user.id,
        actor_id: actorId,
        source: params.source,
        input_params: params.input as Record<string, unknown>,
        status: "running",
        started_at: new Date().toISOString(),
      } as ApifyRunInsert)
      .select()
      .single();

    if (runErr) return { data: null, error: runErr.message };

    // Call Apify API to start actor run
    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params.input),
      }
    );

    if (!apifyRes.ok) {
      const errBody = await apifyRes.text();
      await supabase
        .from("apify_scraper_runs")
        .update({ status: "failed", error_message: `Apify API error: ${apifyRes.status} - ${errBody}` })
        .eq("id", run.id);
      return { data: null, error: `Apify API error: ${apifyRes.status}` };
    }

    const apifyData = await apifyRes.json();
    const apifyRunId = apifyData.data?.id;

    // Update run record with Apify run ID
    await supabase
      .from("apify_scraper_runs")
      .update({ apify_run_id: apifyRunId })
      .eq("id", run.id);

    revalidatePath("/dashboard/lead-scraper");
    return { data: { runId: run.id, searchId: search.id } };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to start scrape" };
  }
}

// ── Check Run Status ──────────────────────────────────────────────────────────

export async function checkApifyRunStatus(runId: string): Promise<{
  data: { status: string; datasetId?: string; resultCount?: number } | null;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId();
    const token = await getApifyToken();

    // Get run record
    const { data: run, error: runErr } = await supabase
      .from("apify_scraper_runs")
      .select("*")
      .eq("id", runId)
      .eq("organization_id", orgId)
      .single();

    if (runErr || !run) return { data: null, error: "Run not found" };
    if (!run.apify_run_id) return { data: { status: run.status }, error: undefined };

    // Check Apify API
    const res = await fetch(
      `https://api.apify.com/v2/actor-runs/${run.apify_run_id}?token=${token}`
    );

    if (!res.ok) return { data: { status: run.status }, error: undefined };

    const apifyData = await res.json();
    const apifyStatus = apifyData.data?.status;

    // Map Apify status to our status
    let newStatus = run.status;
    if (apifyStatus === "SUCCEEDED") newStatus = "succeeded";
    else if (apifyStatus === "FAILED" || apifyStatus === "ABORTED") newStatus = "failed";
    else if (apifyStatus === "TIMED-OUT") newStatus = "timed_out";
    else if (apifyStatus === "RUNNING" || apifyStatus === "READY") newStatus = "running";

    const datasetId = apifyData.data?.defaultDatasetId;

    // Update DB
    await supabase
      .from("apify_scraper_runs")
      .update({
        status: newStatus,
        apify_dataset_id: datasetId || run.apify_dataset_id,
        completed_at: newStatus === "succeeded" || newStatus === "failed" || newStatus === "timed_out"
          ? new Date().toISOString()
          : null,
        error_message: apifyStatus === "FAILED" ? (apifyData.data?.statusMessage || "Actor failed") : null,
      })
      .eq("id", runId);

    return {
      data: {
        status: newStatus,
        datasetId: datasetId || run.apify_dataset_id || undefined,
        resultCount: run.result_count,
      },
    };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Status check failed" };
  }
}

// ── Fetch & Store Results ─────────────────────────────────────────────────────

export async function fetchApifyResults(runId: string): Promise<{
  data: { imported: number } | null;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId();
    const token = await getApifyToken();

    const { data: run, error: runErr } = await supabase
      .from("apify_scraper_runs")
      .select("*")
      .eq("id", runId)
      .eq("organization_id", orgId)
      .single();

    if (runErr || !run) return { data: null, error: "Run not found" };
    if (!run.apify_dataset_id) return { data: null, error: "No dataset available yet" };

    // Fetch dataset items from Apify
    const res = await fetch(
      `https://api.apify.com/v2/datasets/${run.apify_dataset_id}/items?token=${token}&limit=500`
    );

    if (!res.ok) return { data: null, error: `Failed to fetch results: ${res.status}` };

    const items: Record<string, unknown>[] = await res.json();

    if (!items.length) {
      await supabase
        .from("apify_scraper_runs")
        .update({ result_count: 0, status: "succeeded" })
        .eq("id", runId);
      return { data: { imported: 0 } };
    }

    // Transform based on source
    const transformFn = TRANSFORM_MAP[run.source as keyof typeof TRANSFORM_MAP];
    if (!transformFn) return { data: null, error: "Unknown source type" };

    const leads: ScrapedLeadInsert[] = items
      .map((item) => transformFn(item, orgId, run.search_id))
      .filter((l): l is ScrapedLeadInsert => l !== null);

    // Bulk insert (batch of 100)
    let totalInserted = 0;
    for (let i = 0; i < leads.length; i += 100) {
      const batch = leads.slice(i, i + 100);
      const { error: insertErr } = await supabase
        .from("scraped_leads")
        .insert(batch);
      if (!insertErr) totalInserted += batch.length;
    }

    // Update run record
    await supabase
      .from("apify_scraper_runs")
      .update({ result_count: totalInserted, status: "succeeded" })
      .eq("id", runId);

    // Update search result count
    if (run.search_id) {
      await supabase
        .from("lead_searches")
        .update({ result_count: totalInserted, last_run_at: new Date().toISOString() })
        .eq("id", run.search_id);
    }

    revalidatePath("/dashboard/lead-scraper");
    return { data: { imported: totalInserted } };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch results" };
  }
}

// ── Transform Functions ───────────────────────────────────────────────────────

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  return { first: parts[0] || "", last: parts.slice(1).join(" ") || "" };
}

function transformGooglePlaces(
  item: Record<string, unknown>,
  orgId: string,
  searchId: string | null
): ScrapedLeadInsert | null {
  const title = (item.title || item.name || "") as string;
  if (!title) return null;

  return {
    organization_id: orgId,
    search_id: searchId,
    company: title,
    location: (item.address || item.street || "") as string,
    phone: (item.phone || item.phoneUnformatted || "") as string,
    company_website: (item.website || item.url || "") as string,
    industry: Array.isArray(item.categories) ? (item.categories[0] as string) || null : (item.categoryName as string) || null,
    source: "google_places",
    metadata: {
      rating: item.totalScore || item.rating,
      reviews: item.reviewsCount,
      place_id: item.placeId,
      coordinates: item.location,
      google_url: item.url,
      categories: item.categories,
    } as unknown as Json,
  };
}

function transformInstagram(
  item: Record<string, unknown>,
  orgId: string,
  searchId: string | null
): ScrapedLeadInsert | null {
  const username = (item.username || "") as string;
  const fullName = (item.fullName || item.full_name || "") as string;
  if (!username && !fullName) return null;

  const { first, last } = fullName ? splitName(fullName) : { first: username, last: "" };

  return {
    organization_id: orgId,
    search_id: searchId,
    first_name: first,
    last_name: last,
    title: (item.biography || item.bio || "") as string,
    linkedin_url: `https://instagram.com/${username}`,
    company_website: (item.externalUrl || item.external_url || "") as string,
    source: "instagram",
    metadata: {
      username,
      followers: item.followersCount || item.follower_count,
      following: item.followsCount || item.following_count,
      posts: item.postsCount || item.media_count,
      is_business: item.isBusinessAccount || item.is_business,
      profile_pic: item.profilePicUrl || item.profile_pic_url,
      is_verified: item.verified || item.isVerified,
    } as unknown as Json,
  };
}

function transformLinkedIn(
  item: Record<string, unknown>,
  orgId: string,
  searchId: string | null
): ScrapedLeadInsert | null {
  const firstName = (item.firstName || item.first_name || "") as string;
  const lastName = (item.lastName || item.last_name || "") as string;
  const fullName = (item.fullName || item.full_name || "") as string;

  let first = firstName;
  let last = lastName;
  if (!first && !last && fullName) {
    const parts = splitName(fullName);
    first = parts.first;
    last = parts.last;
  }
  if (!first && !last) return null;

  return {
    organization_id: orgId,
    search_id: searchId,
    first_name: first,
    last_name: last,
    title: (item.headline || item.title || item.jobTitle || "") as string,
    company: (item.companyName || item.company || item.currentCompany || "") as string,
    location: (item.location || item.city || "") as string,
    linkedin_url: (item.profileUrl || item.linkedInUrl || item.url || "") as string,
    email: (item.email || "") as string,
    industry: (item.industry || "") as string,
    source: "linkedin",
    metadata: {
      skills: item.skills,
      experience: item.experience || item.positions,
      education: item.education,
      connections: item.connectionCount || item.connections,
      summary: item.summary || item.about,
    } as unknown as Json,
  };
}

function transformLeadsFinder(
  item: Record<string, unknown>,
  orgId: string,
  searchId: string | null
): ScrapedLeadInsert | null {
  const fullName = (item.full_name || item.name || "") as string;
  const firstName = (item.first_name || "") as string;
  const lastName = (item.last_name || "") as string;

  let first = firstName;
  let last = lastName;
  if (!first && !last && fullName) {
    const parts = splitName(fullName);
    first = parts.first;
    last = parts.last;
  }
  if (!first && !last) return null;

  return {
    organization_id: orgId,
    search_id: searchId,
    first_name: first,
    last_name: last,
    title: (item.title || item.job_title || "") as string,
    company: (item.company_name || item.company || "") as string,
    email: (item.email || "") as string,
    phone: (item.phone || "") as string,
    linkedin_url: (item.linkedin_url || item.linkedinUrl || "") as string,
    industry: (item.company_industry || item.industry || "") as string,
    location: (item.company_city || item.location || item.company_country || "") as string,
    company_website: (item.company_domain || item.domain || "") as string,
    company_size: (item.company_size || item.employees || "") as string,
    source: "leads_finder",
    metadata: {
      company_address: item.company_full_address || item.company_street_address,
      funding: item.funding,
      revenue: item.revenue,
    } as unknown as Json,
  };
}

const TRANSFORM_MAP = {
  google_places: transformGooglePlaces,
  instagram: transformInstagram,
  linkedin: transformLinkedIn,
  leads_finder: transformLeadsFinder,
};

// ── Active Runs ───────────────────────────────────────────────────────────────

export async function getActiveApifyRuns(): Promise<{
  data: ApifyRunRow[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId();

    const { data, error } = await supabase
      .from("apify_scraper_runs")
      .select("*")
      .eq("organization_id", orgId)
      .in("status", ["pending", "running"])
      .order("created_at", { ascending: false });

    return { data: data || [], error: error?.message };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : "Failed to get active runs" };
  }
}

// ── Run History ───────────────────────────────────────────────────────────────

export async function getApifyRunHistory(limit = 20): Promise<{
  data: ApifyRunRow[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId();

    const { data, error } = await supabase
      .from("apify_scraper_runs")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data: data || [], error: error?.message };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : "Failed to get run history" };
  }
}

// ── ICP-Aligned Filters ───────────────────────────────────────────────────────

export async function getICPAlignedFilters(): Promise<{
  data: {
    profileName: string;
    industries: string[];
    companySizes: string[];
    geographies: string[];
    employeeRange: { min: number | null; max: number | null };
  } | null;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId();

    // Get primary ICP profile
    const { data: profile, error } = await supabase
      .from("icp_profiles")
      .select("*")
      .eq("organization_id", orgId)
      .eq("is_primary", true)
      .single();

    if (error || !profile) {
      // Try any ICP profile
      const { data: anyProfile } = await supabase
        .from("icp_profiles")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!anyProfile) return { data: null, error: "No ICP profile found. Create one in the ICP page first." };

      const criteria = anyProfile.criteria as Record<string, unknown> || {};
      const firmographic = (criteria.firmographic || {}) as Record<string, unknown>;

      return {
        data: {
          profileName: anyProfile.name,
          industries: (firmographic.industries as string[]) || [],
          companySizes: (firmographic.company_sizes as string[]) || [],
          geographies: (firmographic.geography as string[]) || [],
          employeeRange: (firmographic.employee_range as { min: number | null; max: number | null }) || { min: null, max: null },
        },
      };
    }

    const criteria = profile.criteria as Record<string, unknown> || {};
    const firmographic = (criteria.firmographic || {}) as Record<string, unknown>;

    return {
      data: {
        profileName: profile.name,
        industries: (firmographic.industries as string[]) || [],
        companySizes: (firmographic.company_sizes as string[]) || [],
        geographies: (firmographic.geography as string[]) || [],
        employeeRange: (firmographic.employee_range as { min: number | null; max: number | null }) || { min: null, max: null },
      },
    };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to get ICP filters" };
  }
}

// ── Score Scraped Leads Against ICP ───────────────────────────────────────────

export async function scoreScrapedLeadsAgainstICP(leadIds: string[]): Promise<{
  data: { scored: number } | null;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId();

    // Get primary ICP
    const { data: icpProfile } = await supabase
      .from("icp_profiles")
      .select("*")
      .eq("organization_id", orgId)
      .eq("is_primary", true)
      .single();

    if (!icpProfile) return { data: null, error: "No primary ICP profile found" };

    const criteria = icpProfile.criteria as Record<string, unknown> || {};
    const firmographic = (criteria.firmographic || {}) as Record<string, unknown>;
    const targetIndustries = (firmographic.industries as string[]) || [];
    const targetSizes = (firmographic.company_sizes as string[]) || [];
    const targetGeos = (firmographic.geography as string[]) || [];

    // Get leads
    const { data: leads, error: leadsErr } = await supabase
      .from("scraped_leads")
      .select("*")
      .eq("organization_id", orgId)
      .in("id", leadIds);

    if (leadsErr || !leads) return { data: null, error: "Failed to fetch leads" };

    let scored = 0;

    for (const lead of leads) {
      let totalScore = 0;
      let factors = 0;

      // Industry match (0-100)
      if (targetIndustries.length > 0 && lead.industry) {
        const industryLower = lead.industry.toLowerCase();
        const match = targetIndustries.some((t) => industryLower.includes(t.toLowerCase()) || t.toLowerCase().includes(industryLower));
        totalScore += match ? 100 : 10;
        factors++;
      }

      // Size match
      if (targetSizes.length > 0 && lead.company_size) {
        const match = targetSizes.some((s) => s === lead.company_size);
        totalScore += match ? 100 : 30;
        factors++;
      }

      // Geography match
      if (targetGeos.length > 0 && lead.location) {
        const locationLower = lead.location.toLowerCase();
        const match = targetGeos.some((g) => locationLower.includes(g.toLowerCase()));
        totalScore += match ? 100 : 10;
        factors++;
      }

      const finalScore = factors > 0 ? Math.round(totalScore / factors) : 50;

      await supabase
        .from("scraped_leads")
        .update({ icp_match_score: finalScore })
        .eq("id", lead.id);

      scored++;
    }

    revalidatePath("/dashboard/lead-scraper");
    return { data: { scored } };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to score leads" };
  }
}
