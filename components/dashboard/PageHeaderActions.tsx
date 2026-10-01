"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, PlusIcon } from "@/components/ui";
import { AddLeadModal, type LeadFormData } from "../features/AddLeadModal";
import { createLead } from "@/lib/actions/leads";

const splitCsv = (value: string) =>
  value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

export function PageHeaderActions() {
  const router = useRouter();
  const [showAddLead, setShowAddLead] = useState(false);

  const handleAddLead = async (data: LeadFormData) => {
    const result = await createLead({
      name: `${data.firstName} ${data.lastName}`.trim(),
      email: data.email,
      company: data.company,
      title: data.title || null,
      phone: data.phone,
      website: data.website || null,
      linkedin: data.linkedin || null,
      twitter: data.twitter || null,
      source: data.source,
      estimated_value: parseFloat(data.value) || 0,
      status: "warm",
      score: 50,
      pain_points: data.painPoints || null,
      trigger_event: data.triggerEvent || null,
      personal_note: data.personalNote || null,
      referred_by: data.referredBy || null,
      revenue_range: data.revenueRange || null,
      tech_stack: data.techStack || null,
      funding_stage: data.fundingStage || null,
      current_solution: data.currentSolution || null,
      decision_role: data.decisionRole || null,
      timezone: data.timezone || null,
      preferred_language: data.preferredLanguage || null,
      meeting_preference: data.meetingPreference || null,
      tags: data.tags ? splitCsv(data.tags) : [],
      birthday: data.birthday || null,
      content_interests: data.contentInterests ? splitCsv(data.contentInterests) : [],
      assistant_name: data.assistantName || null,
      assistant_email: data.assistantEmail || null,
    });
    if (result.error) {
      toast.error(result.error);
      return false;
    }
    toast.success("Lead added");
    router.refresh();
  };

  return (
    <>
      <Button
        leftIcon={<PlusIcon size={16} weight="bold" />}
        onClick={() => setShowAddLead(true)}
      >
        Add Lead
      </Button>

      <AddLeadModal
        open={showAddLead}
        onClose={() => setShowAddLead(false)}
        onSubmit={handleAddLead}
      />
    </>
  );
}
