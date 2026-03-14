"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId, getCurrentUserProfile } from "./helpers";
import { revalidatePath } from "next/cache";
import type { Database, Json } from "@/types/database";

type ApifyRunInsert = Database["public"]["Tables"]["apify_scraper_runs"]["Insert"];
type ApifyRunRow = Database["public"]["Tables"]["apify_scraper_runs"]["Row"];
type ScrapedLeadInsert = Database["public"]["Tables"]["scraped_leads"]["Insert"];

// Default user agent for Sales Navigator scraper
const navigator_default_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ── Actor ID Mapping ──────────────────────────────────────────────────────────

const ACTOR_MAP: Record<string, string> = {
  google_places: "nwua9Gu5YrADL7ZDj",
  instagram: "apify/instagram-scraper",
  linkedin: "dev_fusion/linkedin-profile-scraper",
  linkedin_sales_nav: "curious_coder/linkedin-sales-navigator-search-scraper",
  leads_finder: "code_crafter/leads-finder",
};

// Resolve actor ID — LinkedIn uses dynamic selection based on mode
function resolveActorId(source: string, input: Record<string, unknown>): string | undefined {
  if (source === "linkedin" && input.linkedinMode === "sales_nav") {
    return ACTOR_MAP.linkedin_sales_nav;
  }
  return ACTOR_MAP[source];
}

// ── Input Transformers ────────────────────────────────────────────────────────
// Map our UI input to the format each Apify actor expects

function transformInputForActor(
  source: string,
  input: Record<string, unknown>
): Record<string, unknown> {
  switch (source) {
    case "google_places":
      return {
        searchStringsArray: input.searchTerms
          ? [input.searchTerms as string]
          : [],
        locationQuery: (input.location as string) || "",
        maxCrawledPlacesPerSearch:
          (input.maxResults as number) || 20,
        language: "en",
        searchMatching: "all",
        placeMinimumStars: "",
        website: "allPlaces",
        skipClosedPlaces: false,
        scrapePlaceDetailPage: true,
        scrapeTableReservationProvider: false,
        includeWebResults: false,
        scrapeDirectories: false,
        maxQuestions: 0,
        scrapeContacts: true,
        scrapeSocialMediaProfiles: {
          facebooks: true,
          instagrams: true,
          youtubes: true,
          tiktoks: true,
          twitters: true,
        },
        maximumLeadsEnrichmentRecords: 50,
        maxReviews: 0,
        reviewsSort: "newest",
        reviewsFilterString: "",
        reviewsOrigin: "all",
        scrapeReviewsPersonalData: true,
        maxImages: 0,
        scrapeImageAuthors: false,
        allPlacesNoSearchAction: "",
      };
    case "instagram": {
      const usernames = (input.usernames as string[]) || [];
      const searchQuery = (input.search as string) || "";
      const result: Record<string, unknown> = {
        resultsType: "details",  // Get full profile details (email, phone, business info)
        resultsLimit: (input.resultsLimit as number) || 20,
        addParentData: false,
      };

      if (usernames.length > 0) {
        // Mode: by username — convert to Instagram profile URLs
        result.directUrls = usernames.map((u) => {
          const clean = u.replace(/^@/, "").trim();
          return clean.startsWith("http") ? clean : `https://www.instagram.com/${clean}/`;
        });
      } else if (searchQuery) {
        // Mode: search by keyword/hashtag/place
        result.search = searchQuery;
        result.searchType = (input.searchType as string) || "user";
        result.searchLimit = (input.resultsLimit as number) || 20;
      }

      return result;
    }
    case "linkedin": {
      if (input.linkedinMode === "sales_nav") {
        // Sales Navigator search mode
        return {
          searchUrl: (input.searchUrl as string) || "",
          cookie: input.cookie || [{}],
          userAgent: (input.userAgent as string) || navigator_default_ua,
          deepScrape: input.deepScrape !== false,  // Default to true for full data
          count: (input.maxResults as number) || 50,
          minDelay: 5,
          maxDelay: 30,
          stopOnRateLimit: true,
        };
      }
      // Profile URL scraper mode
      const profileUrls = (input.profileUrls as string[]) || [];
      return {
        profileUrls,
        mode: (input.mode as string) || "full",
      };
    }
    default:
      return input;
  }
}

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

    const actorId = resolveActorId(params.source, params.input);
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

    // Transform input to match what the Apify actor expects
    const actorInput = transformInputForActor(params.source, params.input);

    // Call Apify API to start actor run
    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actorInput),
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

  // Extract email from various possible fields
  const email = (item.email || item.contactEmail || "") as string;

  // Extract phone - detail page provides more formats
  const phone = (item.phone || item.phoneUnformatted || item.internationalPhone || "") as string;

  // Extract website
  const website = (item.website || item.webUrl || "") as string;

  // Extract social media profiles
  const socialProfiles = item.socialMediaProfiles as Record<string, string> | undefined;
  const facebookUrl = socialProfiles?.facebook || (item.facebookUrl as string) || "";
  const instagramUrl = socialProfiles?.instagram || (item.instagramUrl as string) || "";
  const twitterUrl = socialProfiles?.twitter || (item.twitterUrl as string) || "";

  // Build full address from components
  const address = (item.address || item.street || "") as string;
  const city = (item.city || "") as string;
  const state = (item.state || "") as string;
  const postalCode = (item.postalCode || item.zipCode || "") as string;
  const fullLocation = [address, city, state, postalCode].filter(Boolean).join(", ") || address;

  return {
    organization_id: orgId,
    search_id: searchId,
    company: title,
    email: email || null,
    location: fullLocation,
    phone: phone,
    company_website: website,
    industry: Array.isArray(item.categories) ? (item.categories[0] as string) || null : (item.categoryName as string) || null,
    source: "google_places",
    metadata: {
      rating: item.totalScore || item.rating,
      reviews: item.reviewsCount,
      place_id: item.placeId,
      coordinates: item.location,
      google_url: item.url,
      categories: item.categories,
      opening_hours: item.openingHours,
      description: item.description || item.additionalInfo,
      price_range: item.price || item.priceLevel,
      facebook: facebookUrl || undefined,
      instagram: instagramUrl || undefined,
      twitter: twitterUrl || undefined,
      claimed: item.claimed,
      temporarily_closed: item.temporarilyClosed,
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

  // Instagram business profiles expose email & phone
  const email = (item.businessEmail || item.publicEmail || item.email || "") as string;
  const phone = (item.businessPhoneNumber || item.contactPhoneNumber || item.publicPhoneNumber || item.phone || "") as string;
  const website = (item.externalUrl || item.external_url || item.website || "") as string;

  // Business category / industry
  const category = (item.businessCategoryName || item.category_name || item.categoryName || "") as string;

  // Business address
  const businessAddress = item.businessAddress || item.address || item.contactAddress;
  const city = (item.businessCity || item.cityName || "") as string;

  return {
    organization_id: orgId,
    search_id: searchId,
    first_name: first,
    last_name: last,
    email: email || null,
    phone: phone,
    title: (item.biography || item.bio || "") as string,
    company: category || null,
    linkedin_url: `https://instagram.com/${username}`,
    company_website: website,
    location: city || (typeof businessAddress === "string" ? businessAddress : "") || null,
    industry: category || null,
    source: "instagram",
    metadata: {
      username,
      followers: item.followersCount || item.follower_count,
      following: item.followsCount || item.following_count,
      posts: item.postsCount || item.media_count,
      is_business: item.isBusinessAccount || item.is_business,
      profile_pic: item.profilePicUrl || item.profile_pic_url,
      is_verified: item.verified || item.isVerified,
      business_address: businessAddress,
      category: category || undefined,
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

  // Extract phone and website from LinkedIn data
  const phone = (item.phoneNumber || item.phone || item.phones || "") as string;
  const companyWebsite = (item.companyUrl || item.companyWebsite || item.website || "") as string;
  const companySize = (item.companySize || item.employeeCount || item.company_size || "") as string;

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
    phone: typeof phone === "string" ? phone : Array.isArray(phone) ? (phone as string[])[0] || "" : "",
    company_website: companyWebsite,
    company_size: typeof companySize === "string" ? companySize : String(companySize || ""),
    industry: (item.industry || "") as string,
    source: "linkedin",
    metadata: {
      skills: item.skills,
      experience: item.experience || item.positions,
      education: item.education,
      connections: item.connectionCount || item.connections,
      summary: item.summary || item.about,
      company_description: item.companyDescription,
      company_industry: item.companyIndustry,
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
