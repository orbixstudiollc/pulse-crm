"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";
import { revalidatePath } from "next/cache";
import type { Json } from "@/types/database";

// ── BANT Types ──────────────────────────────────────────────────────────────

export type BANTData = {
  budget: {
    score: number; // 0-25
    signals: string[];
    notes: string;
  };
  authority: {
    score: number; // 0-25
    contacts: string[];
    decision_process: string;
  };
  need: {
    score: number; // 0-25
    pain_points: string[];
    severity: string;
  };
  timeline: {
    score: number; // 0-25
    urgency: string;
    trigger_events: string[];
  };
};

// ── MEDDIC Types ────────────────────────────────────────────────────────────

export type MEDDICData = {
  metrics: {
    confidence: "high" | "medium" | "low" | "";
    details: string;
  };
  economic_buyer: {
    identified: boolean;
    name: string;
    title: string;
  };
  decision_criteria: {
    criteria: string[];
    ranked: boolean;
  };
  decision_process: {
    type: "self-serve" | "single" | "committee" | "procurement" | "";
    details: string;
  };
  identify_pain: {
    pains: string[];
    severity: string;
  };
  champion: {
    identified: boolean;
    name: string;
    strength: string;
  };
};

export type QualificationData = {
  bant: BANTData;
  meddic: MEDDICData;
};

// ── Default Values ──────────────────────────────────────────────────────────

const defaultBANT: BANTData = {
  budget: { score: 0, signals: [], notes: "" },
  authority: { score: 0, contacts: [], decision_process: "" },
  need: { score: 0, pain_points: [], severity: "" },
  timeline: { score: 0, urgency: "", trigger_events: [] },
};

const defaultMEDDIC: MEDDICData = {
  metrics: { confidence: "", details: "" },
  economic_buyer: { identified: false, name: "", title: "" },
  decision_criteria: { criteria: [], ranked: false },
  decision_process: { type: "", details: "" },
  identify_pain: { pains: [], severity: "" },
  champion: { identified: false, name: "", strength: "" },
};

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getQualificationData(leadId: string) {
  const supabase = await createClient();
  await getOrgId();

  const { data, error } = await supabase
    .from("leads")
    .select("qualification_data, qualification_grade, qualification_score")
    .eq("id", leadId)
    .single();

  if (error) return { error: error.message, data: null };

  const qualData = data.qualification_data as unknown as QualificationData | null;

  return {
    data: {
      qualification_data: qualData || { bant: defaultBANT, meddic: defaultMEDDIC },
      qualification_grade: data.qualification_grade,
      qualification_score: data.qualification_score,
    },
  };
}

// ── BANT Update ─────────────────────────────────────────────────────────────

export async function updateBANT(leadId: string, bant: BANTData) {
  const supabase = await createClient();
  await getOrgId();

  // Get existing qualification data
  const { data: lead } = await supabase
    .from("leads")
    .select("qualification_data")
    .eq("id", leadId)
    .single();

  const existing = (lead?.qualification_data as unknown as QualificationData) || {
    bant: defaultBANT,
    meddic: defaultMEDDIC,
  };

  const updated: QualificationData = {
    ...existing,
    bant,
  };

  const { score, grade } = calculateQualificationScore(updated);

  const { error } = await supabase
    .from("leads")
    .update({
      qualification_data: updated as unknown as Json,
      qualification_score: score,
      qualification_grade: grade,
    })
    .eq("id", leadId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/leads/${leadId}`);
  revalidatePath("/dashboard/leads");
  return { data: { score, grade } };
}

// ── MEDDIC Update ───────────────────────────────────────────────────────────

export async function updateMEDDIC(leadId: string, meddic: MEDDICData) {
  const supabase = await createClient();
  await getOrgId();

  const { data: lead } = await supabase
    .from("leads")
    .select("qualification_data")
    .eq("id", leadId)
    .single();

  const existing = (lead?.qualification_data as unknown as QualificationData) || {
    bant: defaultBANT,
    meddic: defaultMEDDIC,
  };

  const updated: QualificationData = {
    ...existing,
    meddic,
  };

  const { score, grade } = calculateQualificationScore(updated);

  const { error } = await supabase
    .from("leads")
    .update({
      qualification_data: updated as unknown as Json,
      qualification_score: score,
      qualification_grade: grade,
    })
    .eq("id", leadId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/leads/${leadId}`);
  revalidatePath("/dashboard/leads");
  return { data: { score, grade } };
}

// ── Scoring ─────────────────────────────────────────────────────────────────

function calculateQualificationScore(data: QualificationData): {
  score: number;
  grade: string;
} {
  // BANT score: sum of 4 dimensions (each 0-25) = 0-100
  const bantTotal =
    data.bant.budget.score +
    data.bant.authority.score +
    data.bant.need.score +
    data.bant.timeline.score;

  // MEDDIC completeness: each element worth ~16.67 points
  let meddicScore = 0;

  // Metrics (0-16.67)
  if (data.meddic.metrics.confidence === "high") meddicScore += 16.67;
  else if (data.meddic.metrics.confidence === "medium") meddicScore += 10;
  else if (data.meddic.metrics.confidence === "low") meddicScore += 5;

  // Economic Buyer (0-16.67)
  if (data.meddic.economic_buyer.identified) {
    meddicScore += 10;
    if (data.meddic.economic_buyer.name) meddicScore += 3.33;
    if (data.meddic.economic_buyer.title) meddicScore += 3.34;
  }

  // Decision Criteria (0-16.67)
  if (data.meddic.decision_criteria.criteria.length > 0) {
    meddicScore += 10;
    if (data.meddic.decision_criteria.ranked) meddicScore += 6.67;
  }

  // Decision Process (0-16.67)
  if (data.meddic.decision_process.type) {
    meddicScore += 10;
    if (data.meddic.decision_process.details) meddicScore += 6.67;
  }

  // Identify Pain (0-16.67)
  if (data.meddic.identify_pain.pains.length > 0) {
    meddicScore += 10;
    if (data.meddic.identify_pain.severity) meddicScore += 6.67;
  }

  // Champion (0-16.67)
  if (data.meddic.champion.identified) {
    meddicScore += 10;
    if (data.meddic.champion.name) meddicScore += 3.33;
    if (data.meddic.champion.strength) meddicScore += 3.34;
  }

  // Composite: 60% BANT + 40% MEDDIC
  const composite = Math.round(bantTotal * 0.6 + meddicScore * 0.4);

  let grade: string;
  if (composite >= 80) grade = "A";
  else if (composite >= 60) grade = "B";
  else if (composite >= 40) grade = "C";
  else grade = "D";

  return { score: composite, grade };
}
