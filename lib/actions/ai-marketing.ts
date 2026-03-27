"use server";

import { createClient } from "@/lib/supabase/server";
import { getAIClient, callAIWithFallback } from "@/lib/ai/client";
import { getModelForFeature } from "@/lib/ai/models";
import { revalidatePath } from "next/cache";
import type { Json } from "@/types/database";

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseJSON<T>(text: string): T {
  // Try markdown code block first
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1].trim()) as T;
  }

  // Try to find JSON object/array in the text
  const jsonStart = text.indexOf("{");
  const jsonArrayStart = text.indexOf("[");
  const start = jsonStart >= 0 && (jsonArrayStart < 0 || jsonStart < jsonArrayStart) ? jsonStart : jsonArrayStart;

  if (start >= 0) {
    const isArray = text[start] === "[";
    const closeChar = isArray ? "]" : "}";

    // Find the matching closing bracket
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === "{" || text[i] === "[") depth++;
      if (text[i] === "}" || text[i] === "]") depth--;
      if (depth === 0) {
        return JSON.parse(text.substring(start, i + 1)) as T;
      }
    }
  }

  // Last resort: try parsing as-is
  return JSON.parse(text.trim()) as T;
}

function gradeFromScore(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

// ── Types ───────────────────────────────────────────────────────────────────

interface AuditDimensionResult {
  score: number;
  findings: Array<{
    severity: string;
    finding: string;
    evidence: string;
    recommendation: string;
    impact_estimate: string;
  }>;
  action_items: Array<{
    title: string;
    description: string;
    tier: string;
    priority: string;
    effort: string;
    impact_estimate: string;
  }>;
  summary: string;
}

interface FullAuditResult {
  overall_score: number;
  content: AuditDimensionResult;
  conversion: AuditDimensionResult;
  seo: AuditDimensionResult;
  competitive: AuditDimensionResult;
  brand: AuditDimensionResult;
  growth: AuditDimensionResult;
  business_type: string;
  executive_summary: string;
}

interface EmailSequenceResult {
  sequence_type: string;
  target_audience: string;
  emails: Array<{
    email_number: number;
    name: string;
    send_timing: string;
    subject_line: string;
    subject_line_variant: string;
    preview_text: string;
    body_copy: string;
    cta_text: string;
    goal: string;
  }>;
  segmentation_tips: string[];
}

interface SocialCalendarResult {
  platforms: string[];
  content_pillars: string[];
  posts: Array<{
    day: number;
    platform: string;
    content_type: string;
    hook: string;
    copy: string;
    hashtags: string[];
    pillar: string;
  }>;
}

interface AdCampaignResult {
  platform: string;
  campaign_objective: string;
  target_audience: string;
  ads: Array<{
    ad_name: string;
    headline: string;
    primary_text: string;
    description: string;
    cta: string;
    creative_direction: string;
  }>;
  budget_recommendation: string;
}

// ── System Prompts ──────────────────────────────────────────────────────────

const MARKETING_PROMPTS = {
  audit_dimension: `You are an expert marketing analyst. Analyze the provided website URL and data for a specific dimension of a marketing audit.

Score the dimension 0-100. Provide specific, actionable findings with evidence and recommendations.

Return ONLY valid JSON matching this structure:
{
  "score": number (0-100),
  "findings": [{ "severity": "Critical|High|Medium|Low", "finding": string, "evidence": string, "recommendation": string, "impact_estimate": string }],
  "action_items": [{ "title": string, "description": string, "tier": "quick_win|medium_term|strategic", "priority": "critical|high|medium|low", "effort": "low|medium|high", "impact_estimate": string }],
  "summary": string (2-3 sentence summary)
}`,

  full_audit_synthesis: `You are a senior marketing strategist. Synthesize the dimension scores into an executive summary.

Given the 6 dimension scores and findings, produce:
- An overall_score (weighted: content 25%, conversion 20%, seo 20%, competitive 15%, brand 10%, growth 10%)
- business_type detection (saas|ecommerce|agency|local|creator|marketplace)
- executive_summary (3-5 sentences)

Return ONLY valid JSON: { "overall_score": number, "business_type": string, "executive_summary": string }`,

  email_sequence: `You are an expert email marketer. Generate a complete email sequence.

Generate 5-8 emails for the specified sequence type. Each email should have:
- Subject line with proven copywriting formula (PAS, AIDA, Curiosity Gap, etc.)
- A variant subject line for A/B testing
- Preview text
- Full body copy with clear structure
- Strong CTA

Return ONLY valid JSON matching the schema provided.`,

  social_calendar: `You are a social media strategist. Create a 30-day content calendar.

Generate platform-specific content with:
- 4-5 content pillars
- Mix: 40% educational, 20% behind-scenes, 15% social proof, 15% engagement, 10% promotional
- Hooks that stop the scroll
- Platform-appropriate formats (LinkedIn carousels, Twitter threads, Instagram Reels, etc.)

Return ONLY valid JSON matching the schema provided.`,

  ad_campaign: `You are a performance marketing expert. Generate ad creative and copy for the specified platform.

Create 3-5 ad variations with:
- Headlines that grab attention (under 40 chars for Google, flexible for Meta)
- Compelling primary text with clear value prop
- Strong CTAs
- Creative direction notes
- Budget recommendation

Return ONLY valid JSON matching the schema provided.`,

  seo_audit: `You are a technical SEO expert. Analyze the website for on-page SEO, technical SEO, and content gaps.

Evaluate: title tags, meta descriptions, heading hierarchy, internal linking, page speed indicators, mobile-friendliness, schema markup, content quality and depth, keyword targeting.

Return findings and action items in the standard audit dimension format.`,

  copywriting_analysis: `You are a world-class copywriter. Analyze the website copy for effectiveness.

Evaluate: headline clarity, value proposition, CTA strength, voice/tone consistency, persuasion techniques (PAS, AIDA, social proof), readability, urgency/scarcity.

Return findings and action items in the standard audit dimension format.`,

  brand_voice: `You are a brand strategist. Analyze the website to create a brand voice guide.

Evaluate: tone dimensions (formal/casual, serious/playful, technical/simple), messaging consistency, value alignment, personality traits, target audience fit.

Return a comprehensive brand voice analysis with guidelines.`,

  landing_page_cro: `You are a conversion rate optimization expert. Analyze the landing page for conversion effectiveness.

Evaluate: above-fold content, CTA placement and copy, form friction, social proof, trust signals, page load indicators, mobile experience, visual hierarchy.

Return findings and action items in the standard audit dimension format.`,

  funnel_analysis: `You are a sales funnel expert. Map and analyze the sales funnel visible from the website.

Evaluate: funnel type (lead gen, SaaS trial, e-commerce, etc.), stage identification, friction points, drop-off risks, upsell/cross-sell opportunities.

Return findings and action items in the standard audit dimension format.`,

  launch_playbook: `You are a product launch strategist. Create a comprehensive launch playbook.

Include: pre-launch (30 days), launch week, post-launch (30 days) phases with specific tactics, timeline, channels, content plan, and success metrics.

Return ONLY valid JSON with the launch plan structure.`,

  client_proposal: `You are a marketing agency strategist. Generate a client proposal based on the audit findings.

Include: executive summary, key findings, recommended services, pricing tiers (3 options), timeline, expected ROI, next steps.

Return ONLY valid JSON with the proposal structure.`,

  marketing_report: `You are a marketing analyst preparing a comprehensive report.

Compile all audit data into a well-structured markdown report with:
- Executive Summary with overall score and grade
- Score breakdown by dimension
- Top findings organized by severity
- Prioritized action plan (quick wins, medium-term, strategic)
- Competitor insights (if available)
- Revenue impact estimates
- Next steps

Return the full markdown content as a string.`,
};

// ── Website Content Fetcher ──────────────────────────────────────────────────

export async function fetchWebsiteContent(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PulseCRM/1.0; Marketing Audit)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return `[Failed to fetch: HTTP ${res.status}]`;

    const html = await res.text();

    // Extract useful content from HTML (strip scripts, styles, keep text)
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "[NAV]")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "[FOOTER]")
      .replace(/<header[\s\S]*?<\/header>/gi, "[HEADER]")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Extract meta tags separately
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi);
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);

    const meta = [
      `Title: ${titleMatch?.[1]?.trim() || "N/A"}`,
      `Meta Description: ${metaDescMatch?.[1]?.trim() || "N/A"}`,
      `OG Title: ${ogTitleMatch?.[1]?.trim() || "N/A"}`,
      `H1 Tags: ${h1Match ? h1Match.map(h => h.replace(/<[^>]+>/g, "").trim()).join(" | ") : "N/A"}`,
    ].join("\n");

    // Truncate content to fit in context
    const contentPreview = cleaned.substring(0, 3000);

    return `## Website Metadata\n${meta}\n\n## Page Content (first 3000 chars)\n${contentPreview}`;
  } catch (error) {
    return `[Failed to fetch website: ${error instanceof Error ? error.message : "Unknown error"}]`;
  }
}

// ── Core Audit Functions ────────────────────────────────────────────────────

export async function runDimensionAnalysis(
  auditId: string,
  dimension: string,
  websiteUrl: string,
  websiteContent: string,
  dimensionPrompt: string,
): Promise<AuditDimensionResult | { error: string }> {
  try {
    const { settings, orgId, userId } = await getAIClient();

    if (settings.feature_marketing === false) {
      return { error: "Marketing AI is disabled in settings" };
    }

    const modelId = getModelForFeature("marketing", undefined, settings.ai_provider);

    const { response } = await callAIWithFallback({
      settings,
      createParams: (model) => ({
        model,
        max_tokens: 2048,
        system: MARKETING_PROMPTS.audit_dimension,
        messages: [{
          role: "user",
          content: `Analyze this website for the "${dimension}" dimension of a marketing audit.\n\nWebsite URL: ${websiteUrl}\n\n${websiteContent}\n\n${dimensionPrompt}\n\nBased on the website content above, provide specific, actionable findings with real evidence from the content. Score 0-100. Return ONLY valid JSON.`,
        }],
      }),
      feature: "marketing",
      orgId,
      userId,
      modelOverride: modelId,
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    return parseJSON<AuditDimensionResult>(text);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Dimension analysis failed" };
  }
}

export async function aiRunFullAudit(auditId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Get audit record
  const { data: auditRaw, error: fetchErr } = await supabase
    .from("marketing_audits" as any)
    .select("*")
    .eq("id", auditId)
    .single();

  if (fetchErr || !auditRaw) return { success: false, error: "Audit not found" };
  const audit = auditRaw as any;

  // Mark as running
  await supabase
    .from("marketing_audits" as any)
    .update({ status: "running", progress: 0 })
    .eq("id", auditId);

  try {
    const url = audit.website_url;

    // Fetch website content once, reuse for all dimensions
    const websiteContent = await fetchWebsiteContent(url);

    const dimensions = [
      { key: "content", label: "Content & Messaging", prompt: "Evaluate headline clarity, value propositions, CTAs, content quality, persuasion techniques, and overall messaging effectiveness." },
      { key: "conversion", label: "Conversion Optimization", prompt: "Evaluate CTA placement, form design, friction points, social proof, urgency elements, and conversion path clarity." },
      { key: "seo", label: "SEO & Discoverability", prompt: "Evaluate title tags, meta descriptions, heading hierarchy, content depth, keyword targeting, technical SEO signals, and schema markup." },
      { key: "competitive", label: "Competitive Positioning", prompt: "Evaluate differentiation, positioning clarity, unique value proposition, competitive awareness, and market positioning." },
      { key: "brand", label: "Brand & Trust", prompt: "Evaluate visual consistency, trust signals, social proof, authority markers, professional quality, and brand coherence." },
      { key: "growth", label: "Growth & Strategy", prompt: "Evaluate pricing strategy, acquisition channels, retention mechanisms, growth loops, and strategic scalability." },
    ];

    const results: Record<string, AuditDimensionResult> = {};
    const allFindings: FullAuditResult["content"]["findings"] = [];
    const allActionItems: FullAuditResult["content"]["action_items"] = [];

    // Run each dimension sequentially (to stay within serverless limits)
    for (let i = 0; i < dimensions.length; i++) {
      const dim = dimensions[i];
      const progress = Math.round(((i + 1) / dimensions.length) * 85);

      const result = await runDimensionAnalysis(auditId, dim.label, url, websiteContent, dim.prompt);

      if ("error" in result) {
        results[dim.key] = { score: 0, findings: [], action_items: [], summary: `Analysis failed: ${result.error}` };
      } else {
        results[dim.key] = result;
        allFindings.push(...result.findings.map(f => ({ ...f, category: dim.key })));
        allActionItems.push(...result.action_items.map(a => ({ ...a, category: dim.key })));
      }

      await supabase
        .from("marketing_audits" as any)
        .update({ progress })
        .eq("id", auditId);
    }

    // Calculate weighted overall score
    const weights = { content: 0.25, conversion: 0.20, seo: 0.20, competitive: 0.15, brand: 0.10, growth: 0.10 };
    const overallScore = Math.round(
      Object.entries(weights).reduce((sum, [key, weight]) => {
        return sum + (results[key]?.score ?? 0) * weight;
      }, 0)
    );

    // Synthesize executive summary
    let executiveSummary = `Marketing audit of ${url} scored ${overallScore}/100 (${gradeFromScore(overallScore)}). `;
    const topDim = Object.entries(results).sort((a, b) => b[1].score - a[1].score)[0];
    const bottomDim = Object.entries(results).sort((a, b) => a[1].score - b[1].score)[0];
    executiveSummary += `Strongest area: ${topDim[0]} (${topDim[1].score}/100). `;
    executiveSummary += `Biggest opportunity: ${bottomDim[0]} (${bottomDim[1].score}/100). `;
    executiveSummary += `Found ${allFindings.filter(f => f.severity === "Critical" || f.severity === "High").length} critical/high-priority issues.`;

    const fullResult: FullAuditResult = {
      overall_score: overallScore,
      content: results.content,
      conversion: results.conversion,
      seo: results.seo,
      competitive: results.competitive,
      brand: results.brand,
      growth: results.growth,
      business_type: "saas",
      executive_summary: executiveSummary,
    };

    // Save results
    await supabase
      .from("marketing_audits" as any)
      .update({
        status: "completed",
        progress: 100,
        overall_score: overallScore,
        content_score: results.content?.score ?? 0,
        conversion_score: results.conversion?.score ?? 0,
        seo_score: results.seo?.score ?? 0,
        competitive_score: results.competitive?.score ?? 0,
        brand_score: results.brand?.score ?? 0,
        growth_score: results.growth?.score ?? 0,
        grade: gradeFromScore(overallScore),
        result: fullResult as unknown as Json,
        summary: executiveSummary,
      })
      .eq("id", auditId);

    // Save action items
    if (allActionItems.length > 0) {
      const orgId = audit.organization_id;
      await supabase
        .from("marketing_action_items" as any)
        .insert(
          allActionItems.map((item) => ({
            organization_id: orgId,
            audit_id: auditId,
            title: item.title,
            description: item.description,
            category: (item as Record<string, string>).category ?? null,
            tier: item.tier,
            priority: item.priority,
            impact_estimate: item.impact_estimate,
            effort: item.effort,
            status: "pending",
          }))
        );
    }

    revalidatePath("/dashboard/marketing");
    revalidatePath(`/dashboard/marketing/${auditId}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Audit failed";
    await supabase
      .from("marketing_audits" as any)
      .update({ status: "failed", error_message: errorMessage })
      .eq("id", auditId);

    return { success: false, error: errorMessage };
  }
}

// ── Client-Orchestrated Full Audit (one dimension at a time) ────────────────

export async function aiRunSingleDimension(
  auditId: string,
  dimensionKey: string,
  dimensionLabel: string,
  dimensionPrompt: string,
  websiteContent: string,
  websiteUrl: string,
  progress: number,
): Promise<{ data?: AuditDimensionResult; error?: string }> {
  const supabase = await createClient();

  const result = await runDimensionAnalysis(auditId, dimensionLabel, websiteUrl, websiteContent, dimensionPrompt);

  // Update progress
  await supabase
    .from("marketing_audits" as any)
    .update({ progress })
    .eq("id", auditId);

  if ("error" in result) {
    return { data: { score: 0, findings: [], action_items: [], summary: `Analysis failed: ${result.error}` } };
  }

  return { data: result };
}

export async function finalizeFullAudit(
  auditId: string,
  dimensionResults: Record<string, AuditDimensionResult>,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const { data: auditRaw } = await supabase
      .from("marketing_audits" as any)
      .select("website_url, organization_id")
      .eq("id", auditId)
      .single();

    if (!auditRaw) return { success: false, error: "Audit not found" };
    const audit = auditRaw as any;

    const weights = { content: 0.25, conversion: 0.20, seo: 0.20, competitive: 0.15, brand: 0.10, growth: 0.10 };
    const overallScore = Math.round(
      Object.entries(weights).reduce((sum, [key, weight]) => {
        return sum + (dimensionResults[key]?.score ?? 0) * weight;
      }, 0)
    );

    const topDim = Object.entries(dimensionResults).sort((a, b) => b[1].score - a[1].score)[0];
    const bottomDim = Object.entries(dimensionResults).sort((a, b) => a[1].score - b[1].score)[0];
    const criticalCount = Object.values(dimensionResults)
      .flatMap(d => d.findings)
      .filter(f => f.severity === "Critical" || f.severity === "High").length;

    const executiveSummary = `Marketing audit of ${audit.website_url} scored ${overallScore}/100 (${gradeFromScore(overallScore)}). Strongest area: ${topDim[0]} (${topDim[1].score}/100). Biggest opportunity: ${bottomDim[0]} (${bottomDim[1].score}/100). Found ${criticalCount} critical/high-priority issues.`;

    const fullResult = {
      overall_score: overallScore,
      ...dimensionResults,
      business_type: "saas",
      executive_summary: executiveSummary,
    };

    await supabase
      .from("marketing_audits" as any)
      .update({
        status: "completed",
        progress: 100,
        overall_score: overallScore,
        content_score: dimensionResults.content?.score ?? 0,
        conversion_score: dimensionResults.conversion?.score ?? 0,
        seo_score: dimensionResults.seo?.score ?? 0,
        competitive_score: dimensionResults.competitive?.score ?? 0,
        brand_score: dimensionResults.brand?.score ?? 0,
        growth_score: dimensionResults.growth?.score ?? 0,
        grade: gradeFromScore(overallScore),
        result: fullResult as unknown as Json,
        summary: executiveSummary,
      })
      .eq("id", auditId);

    // Save action items
    const allActionItems = Object.entries(dimensionResults).flatMap(([key, dim]) =>
      dim.action_items.map(a => ({ ...a, category: key }))
    );

    if (allActionItems.length > 0) {
      await supabase
        .from("marketing_action_items" as any)
        .insert(
          allActionItems.map((item) => ({
            organization_id: audit.organization_id,
            audit_id: auditId,
            title: item.title,
            description: item.description,
            category: (item as any).category ?? null,
            tier: item.tier,
            priority: item.priority,
            impact_estimate: item.impact_estimate,
            effort: item.effort,
            status: "pending",
          }))
        );
    }

    revalidatePath("/dashboard/marketing");
    revalidatePath(`/dashboard/marketing/${auditId}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Finalize failed";
    await supabase
      .from("marketing_audits" as any)
      .update({ status: "failed", error_message: errorMessage })
      .eq("id", auditId);
    return { success: false, error: errorMessage };
  }
}

// ── Quick Snapshot ──────────────────────────────────────────────────────────

export async function aiRunQuickSnapshot(auditId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: auditRaw } = await supabase
    .from("marketing_audits" as any)
    .select("*")
    .eq("id", auditId)
    .single();

  if (!auditRaw) return { success: false, error: "Audit not found" };
  const audit = auditRaw as any;

  await supabase.from("marketing_audits" as any).update({ status: "running", progress: 10 }).eq("id", auditId);

  try {
    const { settings, orgId, userId } = await getAIClient();
    const modelId = getModelForFeature("marketing", undefined, settings.ai_provider);

    const websiteContent = await fetchWebsiteContent(audit.website_url);

    const { response } = await callAIWithFallback({
      settings,
      createParams: (model) => ({
        model,
        max_tokens: 1500,
        system: "You are an expert marketing analyst. Perform a quick marketing snapshot based on the website content provided. Return ONLY valid JSON.",
        messages: [{
          role: "user",
          content: `Quick marketing analysis of: ${audit.website_url}\n\n${websiteContent}\n\nBased on the website content above, provide a JSON with:\n- overall_score: 0-100\n- headline_score: 0-100\n- cta_score: 0-100\n- value_prop_score: 0-100\n- trust_score: 0-100\n- mobile_score: 0-100\n- top_3_issues: string[]\n- top_3_wins: string[]\n- business_type: string\n- executive_summary: string (2-3 sentences)`,
        }],
      }),
      feature: "marketing",
      orgId,
      userId,
      modelOverride: modelId,
    });

    const text = response.content.filter(b => b.type === "text").map(b => b.text).join("");
    const result = parseJSON<Record<string, unknown>>(text);
    const score = Number(result.overall_score) || 50;

    await supabase.from("marketing_audits" as any).update({
      status: "completed",
      progress: 100,
      overall_score: score,
      grade: gradeFromScore(score),
      result: result as Json,
      summary: String(result.executive_summary || ""),
    }).eq("id", auditId);

    revalidatePath("/dashboard/marketing");
    return { success: true };
  } catch (error) {
    await supabase.from("marketing_audits" as any).update({
      status: "failed",
      error_message: error instanceof Error ? error.message : "Quick snapshot failed",
    }).eq("id", auditId);
    return { success: false, error: error instanceof Error ? error.message : "Failed" };
  }
}

// ── Content Generation Functions ────────────────────────────────────────────

export async function aiGenerateEmailSequence(params: {
  websiteUrl: string;
  sequenceType: string;
  targetAudience?: string;
  auditId?: string;
  customerId?: string;
}): Promise<{ data?: Record<string, unknown>; error?: string }> {
  try {
    const { settings, orgId, userId } = await getAIClient();
    if (settings.feature_marketing === false) return { error: "Marketing AI is disabled" };

    const modelId = getModelForFeature("marketing", undefined, settings.ai_provider);

    const { response } = await callAIWithFallback({
      settings,
      createParams: (model) => ({
        model,
        max_tokens: 4000,
        system: MARKETING_PROMPTS.email_sequence,
        messages: [{
          role: "user",
          content: `Generate a ${params.sequenceType} email sequence for: ${params.websiteUrl}\n\nTarget audience: ${params.targetAudience || "General"}\n\nReturn JSON: { "sequence_type": string, "target_audience": string, "emails": [{ "email_number": number, "name": string, "send_timing": string, "subject_line": string, "subject_line_variant": string, "preview_text": string, "body_copy": string, "cta_text": string, "goal": string }], "segmentation_tips": string[] }`,
        }],
      }),
      feature: "marketing",
      orgId,
      userId,
      modelOverride: modelId,
    });

    const text = response.content.filter(b => b.type === "text").map(b => b.text).join("");
    const result = parseJSON<EmailSequenceResult>(text);

    // Save to marketing_content
    const supabase = await createClient();
    const orgIdVal = (await import("./helpers")).getOrgId;
    const org = await orgIdVal();

    await supabase.from("marketing_content" as any).insert({
      organization_id: org,
      audit_id: params.auditId ?? null,
      customer_id: params.customerId ?? null,
      content_type: "email_sequence",
      title: `${params.sequenceType} Email Sequence`,
      status: "completed",
      content: result as unknown as Json,
      model_used: modelId,
      tokens_used: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
    });

    revalidatePath("/dashboard/marketing");
    return { data: result as unknown as Record<string, unknown> };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Email sequence generation failed" };
  }
}

export async function aiGenerateSocialCalendar(params: {
  websiteUrl: string;
  platforms: string[];
  durationDays?: number;
  auditId?: string;
}): Promise<{ data?: Record<string, unknown>; error?: string }> {
  try {
    const { settings, orgId, userId } = await getAIClient();
    if (settings.feature_marketing === false) return { error: "Marketing AI is disabled" };

    const modelId = getModelForFeature("marketing", undefined, settings.ai_provider);

    const { response } = await callAIWithFallback({
      settings,
      createParams: (model) => ({
        model,
        max_tokens: 4000,
        system: MARKETING_PROMPTS.social_calendar,
        messages: [{
          role: "user",
          content: `Create a ${params.durationDays || 30}-day social media content calendar for: ${params.websiteUrl}\n\nPlatforms: ${params.platforms.join(", ")}\n\nReturn JSON: { "platforms": string[], "content_pillars": string[], "posts": [{ "day": number, "platform": string, "content_type": string, "hook": string, "copy": string, "hashtags": string[], "pillar": string }] }`,
        }],
      }),
      feature: "marketing",
      orgId,
      userId,
      modelOverride: modelId,
    });

    const text = response.content.filter(b => b.type === "text").map(b => b.text).join("");
    const result = parseJSON<SocialCalendarResult>(text);

    const supabase = await createClient();
    const { getOrgId } = await import("./helpers");
    const org = await getOrgId();

    await supabase.from("marketing_content" as any).insert({
      organization_id: org,
      audit_id: params.auditId ?? null,
      content_type: "social_calendar",
      title: `${params.durationDays || 30}-Day Social Calendar`,
      status: "completed",
      content: result as unknown as Json,
      model_used: modelId,
      tokens_used: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
    });

    revalidatePath("/dashboard/marketing");
    return { data: result as unknown as Record<string, unknown> };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Social calendar generation failed" };
  }
}

export async function aiGenerateAdCampaign(params: {
  websiteUrl: string;
  platforms: string[];
  budget?: string;
  auditId?: string;
}): Promise<{ data?: Record<string, unknown>; error?: string }> {
  try {
    const { settings, orgId, userId } = await getAIClient();
    if (settings.feature_marketing === false) return { error: "Marketing AI is disabled" };

    const modelId = getModelForFeature("marketing", undefined, settings.ai_provider);

    const { response } = await callAIWithFallback({
      settings,
      createParams: (model) => ({
        model,
        max_tokens: 3000,
        system: MARKETING_PROMPTS.ad_campaign,
        messages: [{
          role: "user",
          content: `Create ad campaigns for: ${params.websiteUrl}\n\nPlatforms: ${params.platforms.join(", ")}\nBudget: ${params.budget || "Not specified"}\n\nReturn JSON: { "campaigns": [{ "platform": string, "campaign_objective": string, "target_audience": string, "ads": [{ "ad_name": string, "headline": string, "primary_text": string, "description": string, "cta": string, "creative_direction": string }], "budget_recommendation": string }] }`,
        }],
      }),
      feature: "marketing",
      orgId,
      userId,
      modelOverride: modelId,
    });

    const text = response.content.filter(b => b.type === "text").map(b => b.text).join("");
    const result = parseJSON<Record<string, unknown>>(text);

    const supabase = await createClient();
    const { getOrgId } = await import("./helpers");
    const org = await getOrgId();

    await supabase.from("marketing_content" as any).insert({
      organization_id: org,
      audit_id: params.auditId ?? null,
      content_type: "ad_campaign",
      title: `Ad Campaign — ${params.platforms.join(", ")}`,
      status: "completed",
      content: result as Json,
      model_used: modelId,
      tokens_used: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
    });

    revalidatePath("/dashboard/marketing");
    return { data: result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Ad campaign generation failed" };
  }
}

export async function aiGenerateLaunchPlaybook(params: {
  productName: string;
  targetAudience: string;
  launchDate?: string;
  websiteUrl?: string;
  auditId?: string;
}): Promise<{ data?: Record<string, unknown>; error?: string }> {
  try {
    const { settings, orgId, userId } = await getAIClient();
    if (settings.feature_marketing === false) return { error: "Marketing AI is disabled" };

    const modelId = getModelForFeature("marketing", undefined, settings.ai_provider);

    const { response } = await callAIWithFallback({
      settings,
      createParams: (model) => ({
        model,
        max_tokens: 4000,
        system: MARKETING_PROMPTS.launch_playbook,
        messages: [{
          role: "user",
          content: `Create a product launch playbook for: ${params.productName}\n\nTarget audience: ${params.targetAudience}\nLaunch date: ${params.launchDate || "TBD"}\nWebsite: ${params.websiteUrl || "N/A"}\n\nReturn JSON: { "product_name": string, "launch_date": string, "phases": [{ "phase": string, "duration": string, "tactics": [{ "tactic": string, "channel": string, "description": string, "timeline": string, "success_metric": string }] }], "content_plan": string[], "success_metrics": [{ "metric": string, "target": string }] }`,
        }],
      }),
      feature: "marketing",
      orgId,
      userId,
      modelOverride: modelId,
    });

    const text = response.content.filter(b => b.type === "text").map(b => b.text).join("");
    const result = parseJSON<Record<string, unknown>>(text);

    const supabase = await createClient();
    const { getOrgId } = await import("./helpers");
    const org = await getOrgId();

    await supabase.from("marketing_content" as any).insert({
      organization_id: org,
      audit_id: params.auditId ?? null,
      content_type: "launch_playbook",
      title: `Launch Playbook — ${params.productName}`,
      status: "completed",
      content: result as Json,
      model_used: modelId,
      tokens_used: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
    });

    revalidatePath("/dashboard/marketing");
    return { data: result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Launch playbook generation failed" };
  }
}

export async function aiGenerateClientProposal(params: {
  auditId: string;
  clientName?: string;
  services?: string[];
}): Promise<{ data?: Record<string, unknown>; error?: string }> {
  try {
    const { settings, orgId, userId } = await getAIClient();
    if (settings.feature_marketing === false) return { error: "Marketing AI is disabled" };

    const supabase = await createClient();
    const { data: auditRaw } = await supabase
      .from("marketing_audits" as any)
      .select("*")
      .eq("id", params.auditId)
      .single();

    if (!auditRaw) return { error: "Audit not found" };
    const audit = auditRaw as any;

    const modelId = getModelForFeature("marketing", undefined, settings.ai_provider);

    const { response } = await callAIWithFallback({
      settings,
      createParams: (model) => ({
        model,
        max_tokens: 4000,
        system: MARKETING_PROMPTS.client_proposal,
        messages: [{
          role: "user",
          content: `Generate a client marketing proposal based on this audit:\n\nClient: ${params.clientName || audit.business_name || "Client"}\nWebsite: ${audit.website_url}\nOverall Score: ${audit.overall_score}/100 (${audit.grade})\nSummary: ${audit.summary || "N/A"}\nKey Scores: Content ${audit.content_score}, Conversion ${audit.conversion_score}, SEO ${audit.seo_score}, Competitive ${audit.competitive_score}, Brand ${audit.brand_score}, Growth ${audit.growth_score}\nRequested Services: ${params.services?.join(", ") || "Full marketing optimization"}\n\nReturn JSON: { "client_name": string, "executive_summary": string, "key_findings": [{ "area": string, "score": number, "issue": string, "opportunity": string }], "recommended_services": [{ "service": string, "description": string, "deliverables": string[] }], "pricing_tiers": [{ "tier": string, "price": string, "includes": string[] }], "timeline": string, "expected_roi": string, "next_steps": string[] }`,
        }],
      }),
      feature: "marketing",
      orgId,
      userId,
      modelOverride: modelId,
    });

    const text = response.content.filter(b => b.type === "text").map(b => b.text).join("");
    const result = parseJSON<Record<string, unknown>>(text);

    const { getOrgId } = await import("./helpers");
    const org = await getOrgId();

    await supabase.from("marketing_content" as any).insert({
      organization_id: org,
      audit_id: params.auditId,
      content_type: "client_proposal",
      title: `Proposal — ${params.clientName || audit.business_name || "Client"}`,
      status: "completed",
      content: result as Json,
      model_used: modelId,
      tokens_used: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
    });

    revalidatePath("/dashboard/marketing");
    return { data: result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Proposal generation failed" };
  }
}

export async function aiGenerateMarketingReport(auditId: string): Promise<{ data?: string; error?: string }> {
  try {
    const { settings, orgId, userId } = await getAIClient();
    if (settings.feature_marketing === false) return { error: "Marketing AI is disabled" };

    const supabase = await createClient();
    const { data: auditRaw } = await supabase.from("marketing_audits" as any).select("*").eq("id", auditId).single();
    if (!auditRaw) return { error: "Audit not found" };
    const audit = auditRaw as any;

    const { data: actionItemsRaw } = await supabase.from("marketing_action_items" as any).select("*").eq("audit_id", auditId);
    const actionItems = (actionItemsRaw || []) as any[];

    const modelId = getModelForFeature("marketing", undefined, settings.ai_provider);

    const { response } = await callAIWithFallback({
      settings,
      createParams: (model) => ({
        model,
        max_tokens: 4000,
        system: MARKETING_PROMPTS.marketing_report,
        messages: [{
          role: "user",
          content: `Generate a comprehensive marketing report in Markdown format.\n\nAudit Data:\n- Website: ${audit.website_url}\n- Business: ${audit.business_name || "N/A"}\n- Overall Score: ${audit.overall_score}/100 (${audit.grade})\n- Content: ${audit.content_score}/100\n- Conversion: ${audit.conversion_score}/100\n- SEO: ${audit.seo_score}/100\n- Competitive: ${audit.competitive_score}/100\n- Brand: ${audit.brand_score}/100\n- Growth: ${audit.growth_score}/100\n- Summary: ${audit.summary}\n\nFull Result:\n${JSON.stringify(audit.result, null, 2).substring(0, 3000)}\n\nAction Items (${actionItems?.length || 0}):\n${(actionItems || []).map(a => `- [${a.priority}] ${a.title}: ${a.description}`).join("\n").substring(0, 1000)}\n\nReturn the full report as Markdown text.`,
        }],
      }),
      feature: "marketing",
      orgId,
      userId,
      modelOverride: modelId,
    });

    const text = response.content.filter(b => b.type === "text").map(b => b.text).join("");

    const { getOrgId } = await import("./helpers");
    const org = await getOrgId();

    await supabase.from("marketing_reports" as any).insert({
      organization_id: org,
      audit_id: auditId,
      report_type: "markdown",
      title: `Marketing Report — ${audit.business_name || audit.website_url}`,
      content: text,
    });

    revalidatePath("/dashboard/marketing");
    return { data: text };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Report generation failed" };
  }
}
