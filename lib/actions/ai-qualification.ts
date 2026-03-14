"use server";

import { createClient } from "@/lib/supabase/server";
import { getAIClient, callAIWithFallback } from "@/lib/ai/client";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";
import { getModelId } from "@/lib/ai/models";
import { revalidatePath } from "next/cache";

// ── JSON Parser ──────────────────────────────────────────────────────────────

function parseJSON<T>(text: string): T {
  // Try to extract from markdown code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();
  return JSON.parse(jsonStr);
}

// ── Types ────────────────────────────────────────────────────────────────────

interface BANTField {
  value: string;
  confidence: number;
}

interface MEDDICField {
  value: string;
  confidence: number;
}

interface QualificationResult {
  bant: {
    budget: BANTField;
    authority: BANTField;
    need: BANTField;
    timeline: BANTField;
  };
  meddic: {
    metrics: MEDDICField;
    economic_buyer: MEDDICField;
    decision_criteria: MEDDICField;
    decision_process: MEDDICField;
    identify_pain: MEDDICField;
    champion: MEDDICField;
  };
  confidence: number;
  gaps: string[];
  next_steps: string[];
}

interface AssessmentResult {
  grade: string;
  score: number;
  assessment: string;
  discovery_questions: string[];
}

// ── aiQualifyLead ────────────────────────────────────────────────────────────

/**
 * AI-powered lead qualification using BANT and MEDDIC frameworks.
 * Fetches lead data, activities, and notes, then uses Claude to
 * infer qualification fields. Does NOT auto-save — returns for user review.
 */
export async function aiQualifyLead(
  leadId: string
): Promise<QualificationResult | { error: string }> {
  try {
    const { settings, orgId, userId } = await getAIClient();

    if (!settings.feature_lead_scoring) {
      return { error: "AI qualification features are disabled in settings" };
    }

    const supabase = await createClient();

    // Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(
        "id, name, email, phone, company, website, linkedin, source, status, score, estimated_value, industry, employees, win_probability, qualification_data, location, organization_id"
      )
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return { error: `Lead not found: ${leadError?.message || "Unknown error"}` };
    }

    // Fetch lead-specific activities
    const { data: leadActivities } = await supabase
      .from("lead_activities")
      .select("id, type, title, description, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(15);

    // Also fetch general activities related to this lead
    const { data: generalActivities } = await supabase
      .from("activities")
      .select("id, type, title, description, status, date, created_at")
      .eq("related_id", leadId)
      .eq("related_type", "lead")
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch notes for this lead
    const { data: notes } = await supabase
      .from("lead_notes")
      .select("id, content, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Build the prompt
    const prompt = buildQualificationPrompt(
      lead,
      leadActivities || [],
      generalActivities || [],
      notes || []
    );

    // Call AI with automatic provider fallback
    const aiResult = await callAIWithFallback({
      settings,
      createParams: (modelId) => ({
        model: modelId,
        max_tokens: 1024,
        system: SYSTEM_PROMPTS.qualification,
        messages: [{ role: "user", content: prompt }],
      }),
      feature: "lead_scoring",
      orgId,
      userId,
      modelOverride: getModelId("haiku", settings?.ai_provider),
    });

    const text = aiResult.response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Parse AI response
    let parsed: {
      bant: Record<string, { value: string; confidence: number }>;
      meddic: Record<string, { value: string; confidence: number }>;
      qualification_score: number;
      assessment: string;
      discovery_questions: string[];
    };

    try {
      parsed = parseJSON(text);
    } catch {
      return { error: "Failed to parse AI qualification response" };
    }

    // Normalize BANT fields
    const bantFields = ["budget", "authority", "need", "timeline"] as const;
    const bant = {} as QualificationResult["bant"];
    for (const field of bantFields) {
      const raw = parsed.bant?.[field];
      bant[field] = {
        value: raw?.value || "",
        confidence: Math.round(Math.min(100, Math.max(0, raw?.confidence ?? 0))),
      };
    }

    // Normalize MEDDIC fields
    const meddicFields = [
      "metrics",
      "economic_buyer",
      "decision_criteria",
      "decision_process",
      "identify_pain",
      "champion",
    ] as const;
    const meddic = {} as QualificationResult["meddic"];
    for (const field of meddicFields) {
      const raw = parsed.meddic?.[field];
      meddic[field] = {
        value: raw?.value || "",
        confidence: Math.round(Math.min(100, Math.max(0, raw?.confidence ?? 0))),
      };
    }

    // Calculate overall confidence from all BANT + MEDDIC field confidences
    const allConfidences = [
      ...bantFields.map((f) => bant[f].confidence),
      ...meddicFields.map((f) => meddic[f].confidence),
    ];
    const overallConfidence =
      allConfidences.length > 0
        ? Math.round(
            allConfidences.reduce((sum, c) => sum + c, 0) / allConfidences.length
          )
        : 0;

    // Identify gaps — fields with low confidence or empty values
    const gaps: string[] = [];
    for (const field of bantFields) {
      if (!bant[field].value || bant[field].confidence < 30) {
        gaps.push(`BANT: ${field} — insufficient data`);
      }
    }
    for (const field of meddicFields) {
      if (!meddic[field].value || meddic[field].confidence < 30) {
        gaps.push(
          `MEDDIC: ${field.replace(/_/g, " ")} — insufficient data`
        );
      }
    }

    // Build next steps from AI suggestions + gap-based suggestions
    const nextSteps = parsed.discovery_questions?.slice(0, 5) || [];
    if (gaps.length > 3 && nextSteps.length < 3) {
      nextSteps.push(
        "Schedule a discovery call to gather missing qualification data"
      );
    }

    const result: QualificationResult = {
      bant,
      meddic,
      confidence: overallConfidence,
      gaps,
      next_steps: nextSteps,
    };

    // Revalidate pages (data isn't saved but UI may refresh context)
    revalidatePath(`/dashboard/leads/${leadId}`);

    return result;
  } catch (error) {
    console.error("[AI Qualification] Failed:", error);
    const errorMessage =
      error instanceof Error ? error.message : "AI qualification failed";
    return { error: errorMessage };
  }
}

// ── aiAssessQualification ────────────────────────────────────────────────────

/**
 * AI-powered assessment of existing lead qualification data.
 * Grades the current qualification (A/B/C/D/F), provides a score,
 * assessment text, and targeted discovery questions to fill gaps.
 */
export async function aiAssessQualification(
  leadId: string
): Promise<AssessmentResult | { error: string }> {
  try {
    const { settings, orgId, userId } = await getAIClient();

    if (!settings.feature_lead_scoring) {
      return { error: "AI qualification features are disabled in settings" };
    }

    const supabase = await createClient();

    // Fetch lead with qualification data
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(
        "id, name, email, company, industry, employees, estimated_value, status, source, win_probability, qualification_data, qualification_grade, qualification_score, location"
      )
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return { error: `Lead not found: ${leadError?.message || "Unknown error"}` };
    }

    if (!lead.qualification_data) {
      return {
        error:
          "No qualification data found for this lead. Run AI Qualify Lead first to generate BANT/MEDDIC data.",
      };
    }

    // Build the prompt
    const prompt = `## Lead Overview
- Name: ${lead.name || "N/A"}
- Company: ${lead.company || "N/A"}
- Industry: ${lead.industry || "N/A"}
- Employees: ${lead.employees || "N/A"}
- Location: ${lead.location || "N/A"}
- Estimated Value: ${lead.estimated_value ? `$${lead.estimated_value}` : "N/A"}
- Source: ${lead.source || "N/A"}
- Status: ${lead.status || "N/A"}
- Win Probability: ${lead.win_probability ? `${lead.win_probability}%` : "N/A"}
- Current Qualification Grade: ${lead.qualification_grade || "Not graded"}
- Current Qualification Score: ${lead.qualification_score ?? "Not scored"}

## Existing Qualification Data (BANT + MEDDIC)
${JSON.stringify(lead.qualification_data, null, 2)}

## Task
Assess the quality and completeness of this lead's qualification data. Grade the overall qualification and identify specific gaps.

Return a JSON object with:
- grade: string (one of "A", "B", "C", "D", "F" — where A = fully qualified with high confidence, F = almost no qualification data)
- score: number (0-100, qualification completeness and quality score)
- assessment: string (2-4 sentence assessment of the lead's qualification status, strengths, and weaknesses)
- discovery_questions: string[] (5-7 targeted discovery questions designed to fill the specific gaps in this lead's qualification data)

Return ONLY valid JSON.`;

    // Call AI with automatic provider fallback
    const aiResult = await callAIWithFallback({
      settings,
      createParams: (modelId) => ({
        model: modelId,
        max_tokens: 1024,
        system: SYSTEM_PROMPTS.qualification,
        messages: [{ role: "user", content: prompt }],
      }),
      feature: "lead_scoring",
      orgId,
      userId,
      modelOverride: getModelId("haiku", settings?.ai_provider),
    });

    const text = aiResult.response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Parse AI response
    let parsed: {
      grade: string;
      score: number;
      assessment: string;
      discovery_questions: string[];
    };

    try {
      parsed = parseJSON(text);
    } catch {
      return { error: "Failed to parse AI assessment response" };
    }

    // Validate grade
    const validGrades = ["A", "B", "C", "D", "F"];
    const grade = validGrades.includes(parsed.grade?.toUpperCase())
      ? parsed.grade.toUpperCase()
      : "C";

    // Validate and clamp score
    const score =
      typeof parsed.score === "number"
        ? Math.round(Math.min(100, Math.max(0, parsed.score)))
        : 50;

    const result: AssessmentResult = {
      grade,
      score,
      assessment: parsed.assessment || "",
      discovery_questions: parsed.discovery_questions || [],
    };

    // Revalidate relevant pages
    revalidatePath(`/dashboard/leads/${leadId}`);

    return result;
  } catch (error) {
    console.error("[AI Assessment] Failed:", error);
    const errorMessage =
      error instanceof Error ? error.message : "AI qualification assessment failed";
    return { error: errorMessage };
  }
}

// ── Prompt Builders ──────────────────────────────────────────────────────────

function buildQualificationPrompt(
  lead: Record<string, unknown>,
  leadActivities: Array<Record<string, unknown>>,
  generalActivities: Array<Record<string, unknown>>,
  notes: Array<Record<string, unknown>>
): string {
  const sections: string[] = [];

  // Lead profile section
  sections.push(`## Lead Profile
- Name: ${lead.name || "N/A"}
- Email: ${lead.email || "N/A"}
- Phone: ${lead.phone || "N/A"}
- Company: ${lead.company || "N/A"}
- Website: ${lead.website || "N/A"}
- LinkedIn: ${lead.linkedin || "N/A"}
- Industry: ${lead.industry || "N/A"}
- Employees: ${lead.employees || "N/A"}
- Location: ${lead.location || "N/A"}
- Source: ${lead.source || "N/A"}
- Status: ${lead.status || "N/A"}
- Estimated Value: ${lead.estimated_value ? `$${lead.estimated_value}` : "N/A"}
- Win Probability: ${lead.win_probability ? `${lead.win_probability}%` : "N/A"}
- Current Score: ${lead.score ?? "Not scored"}`);

  // Existing qualification data if any
  if (lead.qualification_data) {
    sections.push(
      `## Existing Qualification Data\n${JSON.stringify(lead.qualification_data, null, 2)}`
    );
  }

  // Lead-specific activities
  if (leadActivities.length > 0) {
    const activityLines = leadActivities
      .map(
        (a) =>
          `- [${a.type}] ${a.title || ""}${a.description ? `: ${a.description}` : ""} (${a.created_at})`
      )
      .join("\n");
    sections.push(
      `## Lead Activities (${leadActivities.length})\n${activityLines}`
    );
  }

  // General activities related to this lead
  if (generalActivities.length > 0) {
    const genActivityLines = generalActivities
      .map(
        (a) =>
          `- [${a.type}] ${a.title || ""}${a.description ? `: ${a.description}` : ""} — Status: ${a.status || "N/A"} (${a.date || a.created_at})`
      )
      .join("\n");
    sections.push(
      `## Related Activities (${generalActivities.length})\n${genActivityLines}`
    );
  }

  if (leadActivities.length === 0 && generalActivities.length === 0) {
    sections.push("## Activities\nNo activities recorded for this lead.");
  }

  // Notes
  if (notes.length > 0) {
    const noteLines = notes
      .map((n) => `- ${n.content} (${n.created_at})`)
      .join("\n");
    sections.push(`## Notes (${notes.length})\n${noteLines}`);
  } else {
    sections.push("## Notes\nNo notes recorded for this lead.");
  }

  sections.push(`
## Task
Analyze all the above data and qualify this lead using both BANT and MEDDIC frameworks.

For each field, provide:
- value: your assessment based on available data (leave as empty string if truly no data)
- confidence: 0-100 indicating how confident you are in the assessment

Return a JSON object with:
- bant: { budget: { value, confidence }, authority: { value, confidence }, need: { value, confidence }, timeline: { value, confidence } }
- meddic: { metrics: { value, confidence }, economic_buyer: { value, confidence }, decision_criteria: { value, confidence }, decision_process: { value, confidence }, identify_pain: { value, confidence }, champion: { value, confidence } }
- qualification_score: number (0-100 overall qualification completeness)
- assessment: string (brief qualification assessment)
- discovery_questions: string[] (5-7 targeted questions to fill gaps)

Return ONLY valid JSON.`);

  return sections.join("\n\n");
}
