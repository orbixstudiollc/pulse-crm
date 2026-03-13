"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Badge,
  Textarea,
  Avatar,
  EnvelopeIcon,
  PhoneIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  ActionMenu,
  TrashIcon,
  UsersThreeIcon,
  PencilSimpleIcon,
  LightningIcon,
} from "@/components/ui";
import { ActivityRow, type ActivityRowType } from "@/components/dashboard";
import {
  ScheduleMeetingModal,
  CreateTaskModal,
  ActivityDetailDrawer,
  CompleteMeetingModal,
  ConvertLeadModal,
  AddLeadModal,
  ScoreBreakdown,
  ScoreHistoryChart,
  QualificationScorecard,
  BANTEditor,
  MEDDICEditor,
  AIActionButton,
  AIScoreDrawer,
  AIGenerateModal,
  type LeadFormData,
} from "@/components/features";
import { aiScoreLead } from "@/lib/actions/ai-scoring";
import { aiMatchLead } from "@/lib/actions/ai-icp";
import { aiQualifyLead } from "@/lib/actions/ai-qualification";
import { aiGenerateBrief } from "@/lib/actions/ai-meetings";
import type { QualificationData } from "@/lib/actions/qualification";
import { cn } from "@/lib/utils";
import { usePageHeader } from "@/hooks";
import { addLeadNote, deleteLead, updateLead, convertLeadToCustomer } from "@/lib/actions/leads";
import { calculateLeadScore } from "@/lib/actions/scoring";
import { toast } from "sonner";

// --- Types matching DB rows ---

interface LeadRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  status: string;
  source: string | null;
  estimated_value: number | null;
  win_probability: number | null;
  score: number | null;
  score_breakdown: unknown;
  days_in_pipeline: number | null;
  linkedin: string | null;
  twitter: string | null;
  facebook: string | null;
  instagram: string | null;
  title: string | null;
  location: string | null;
  employees: string | null;
  website: string | null;
  industry: string | null;
  created_at: string;
  pain_points: string | null;
  trigger_event: string | null;
  timezone: string | null;
  preferred_language: string | null;
  last_contacted_at: string | null;
  tags: string[] | null;
  revenue_range: string | null;
  tech_stack: string | null;
  funding_stage: string | null;
  decision_role: string | null;
  current_solution: string | null;
  referred_by: string | null;
  personal_note: string | null;
  birthday: string | null;
  content_interests: string[] | null;
  meeting_preference: string | null;
  assistant_name: string | null;
  assistant_email: string | null;
}

interface NoteRow {
  id: string;
  author_name: string | null;
  content: string;
  created_at: string;
}

interface ActivityRow2 {
  id: string;
  type: string;
  title: string;
  description: string | null;
  created_at: string;
}

interface ScoreHistoryEntry {
  id: string;
  lead_id: string;
  score: number;
  breakdown: unknown;
  scored_at: string;
}

interface QualificationDataProp {
  qualification_data: QualificationData;
  qualification_grade: string | null;
  qualification_score: number | null;
}

interface LeadDetailClientProps {
  lead: LeadRow;
  notes: NoteRow[] | undefined;
  activities: ActivityRow2[] | undefined;
  scoreHistory?: ScoreHistoryEntry[];
  qualificationData?: QualificationDataProp;
}

// --- Lead status config ---

const leadStatusConfig: Record<string, { label: string; variant: string }> = {
  new: { label: "New", variant: "blue" },
  contacted: { label: "Contacted", variant: "amber" },
  qualified: { label: "Qualified", variant: "green" },
  proposal: { label: "Proposal", variant: "violet" },
  negotiation: { label: "Negotiation", variant: "amber" },
  won: { label: "Won", variant: "green" },
  lost: { label: "Lost", variant: "red" },
};

export function LeadDetailClient({
  lead,
  notes,
  activities,
  scoreHistory,
  qualificationData,
}: LeadDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const leadNotes = notes || [];
  const activityItems = activities || [];

  const [newNote, setNewNote] = useState("");
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityRow2 | null>(null);
  const [showActivityDrawer, setShowActivityDrawer] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeQualTab, setActiveQualTab] = useState<"overview" | "bant" | "meddic">("overview");

  // AI states
  const [aiScoreDrawerOpen, setAIScoreDrawerOpen] = useState(false);
  const [aiScoreData, setAIScoreData] = useState<any>(null);
  const [aiScoring, setAIScoring] = useState(false);
  const [aiMatching, setAIMatching] = useState(false);
  const [aiQualifying, setAIQualifying] = useState(false);
  const [aiBriefOpen, setAIBriefOpen] = useState(false);

  const statusCfg = leadStatusConfig[lead.status] || { label: lead.status, variant: "neutral" };

  const editLeadFormData = {
    firstName: lead.name.split(" ")[0],
    lastName: lead.name.split(" ").slice(1).join(" "),
    email: lead.email,
    company: lead.company || "",
    phone: lead.phone || "",
    title: lead.title || "",
    website: lead.website || "",
    linkedin: lead.linkedin || "",
    twitter: lead.twitter || "",
    source: (lead.source || "").toLowerCase().replace(" ", "-"),
    value: (lead.estimated_value || 0).toString(),
    notes: "",
    painPoints: lead.pain_points || "",
    triggerEvent: lead.trigger_event || "",
    personalNote: lead.personal_note || "",
    referredBy: lead.referred_by || "",
    revenueRange: lead.revenue_range || "",
    techStack: lead.tech_stack || "",
    fundingStage: lead.funding_stage || "",
    currentSolution: lead.current_solution || "",
    decisionRole: lead.decision_role || "",
    timezone: lead.timezone || "",
    preferredLanguage: lead.preferred_language || "",
    meetingPreference: lead.meeting_preference || "",
    tags: Array.isArray(lead.tags) ? lead.tags.join(", ") : "",
    birthday: lead.birthday || "",
    contentInterests: Array.isArray(lead.content_interests) ? lead.content_interests.join(", ") : "",
    assistantName: lead.assistant_name || "",
    assistantEmail: lead.assistant_email || "",
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    startTransition(async () => {
      const res = await addLeadNote(lead.id, newNote.trim());
      if (res.error) {
        toast.error(res.error);
      } else {
        setNewNote("");
        toast.success("Note added");
        router.refresh();
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    startTransition(async () => {
      const res = await deleteLead(lead.id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Lead deleted");
        router.push("/dashboard/leads");
      }
    });
  };

  const handleConvert = () => {
    startTransition(async () => {
      const res = await convertLeadToCustomer(lead.id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`${lead.name} has been converted to a customer`);
        setShowConvertModal(false);
        router.push("/dashboard/customers");
      }
    });
  };

  const handleEditSubmit = (data: LeadFormData) => {
    startTransition(async () => {
      const res = await updateLead(lead.id, {
        name: `${data.firstName} ${data.lastName}`.trim(),
        email: data.email,
        company: data.company || null,
        phone: data.phone || null,
        title: data.title || null,
        website: data.website || null,
        linkedin: data.linkedin || null,
        twitter: data.twitter || null,
        source: data.source || null,
        estimated_value: parseFloat(data.value) || 0,
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
        tags: data.tags ? data.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
        birthday: data.birthday || null,
        content_interests: data.contentInterests ? data.contentInterests.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
        assistant_name: data.assistantName || null,
        assistant_email: data.assistantEmail || null,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Lead updated");
        setShowEditModal(false);
        router.refresh();
      }
    });
  };

  const handleAIScore = async () => {
    setAIScoring(true);
    try {
      const result = await aiScoreLead(lead.id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        setAIScoreData(result);
        setAIScoreDrawerOpen(true);
        router.refresh();
      }
    } catch {
      toast.error("AI scoring failed");
    } finally {
      setAIScoring(false);
    }
  };

  const handleAIMatch = async () => {
    setAIMatching(true);
    try {
      const result = await aiMatchLead(lead.id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`ICP Match: ${result.match_score}% match`);
        router.refresh();
      }
    } catch {
      toast.error("AI ICP matching failed");
    } finally {
      setAIMatching(false);
    }
  };

  const handleAIQualify = async () => {
    setAIQualifying(true);
    try {
      const result = await aiQualifyLead(lead.id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`Qualification: ${result.confidence}% confidence, ${result.gaps.length} gaps found`);
        router.refresh();
      }
    } catch {
      toast.error("AI qualification failed");
    } finally {
      setAIQualifying(false);
    }
  };

  const handleRecalculateScore = () => {
    startTransition(async () => {
      const result = await calculateLeadScore(lead.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Score recalculated");
        router.refresh();
      }
    });
  };

  const scoreBreakdown = lead.score_breakdown
    ? typeof lead.score_breakdown === "string"
      ? JSON.parse(lead.score_breakdown)
      : lead.score_breakdown
    : null;

  const headerActions = useMemo(
    () => (
      <>
        <Button
          variant="outline"
          leftIcon={<PencilSimpleIcon size={16} />}
          onClick={() => setShowEditModal(true)}
        >
          Edit Lead
        </Button>
        <ActionMenu
          items={[
            {
              label: "Delete Lead",
              icon: <TrashIcon size={16} />,
              variant: "danger",
              onClick: handleDelete,
            },
          ]}
        />
      </>
    ),
    [],
  );

  usePageHeader({
    backHref: "/dashboard/leads",
    actions: headerActions,
    breadcrumbLabel: lead.name,
  });

  return (
    <div className="min-h-full bg-neutral-100 dark:bg-neutral-900 p-4 sm:p-6 lg:p-8">
      {/* Header + Stats Card */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <Avatar
              name={lead.name}
              size="xl"
              className="h-16! w-16! sm:h-20! sm:w-20! text-xl! sm:text-2xl!"
            />
            <div>
              <h1 className="text-2xl font-serif text-neutral-950 dark:text-neutral-50 mb-2">
                {lead.name}
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
                {lead.company || "—"}
              </p>
              <div className="flex items-center gap-2">
                <Badge variant={statusCfg.variant as any} dot>
                  {statusCfg.label}
                </Badge>
                {lead.source && <Badge variant="neutral">{lead.source}</Badge>}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <AIActionButton
                  label="AI Score"
                  onClick={handleAIScore}
                  loading={aiScoring}
                  size="sm"
                />
                <AIActionButton
                  label="ICP Match"
                  onClick={handleAIMatch}
                  loading={aiMatching}
                  size="sm"
                  variant="secondary"
                />
                <AIActionButton
                  label="AI Qualify"
                  onClick={handleAIQualify}
                  loading={aiQualifying}
                  size="sm"
                  variant="secondary"
                />
                <AIActionButton
                  label="Meeting Brief"
                  onClick={() => setAIBriefOpen(true)}
                  size="sm"
                  variant="ghost"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" leftIcon={<PhoneIcon size={18} />}>
              Call
            </Button>
            <Button variant="outline" leftIcon={<EnvelopeIcon size={18} />}>
              Email
            </Button>
            <Button
              variant="outline"
              leftIcon={<LightningIcon size={18} />}
              onClick={handleRecalculateScore}
              disabled={isPending}
            >
              {isPending ? "Scoring..." : "Recalculate Score"}
            </Button>
            <Button
              leftIcon={<UsersThreeIcon size={18} />}
              onClick={() => setShowConvertModal(true)}
            >
              Convert to Customer
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 text-center">
            <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              {formatCurrency(lead.estimated_value || 0)}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Est. Value
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 text-center">
            <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              {lead.win_probability || 0}%
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Win Probability
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 text-center">
            <p className={cn(
              "text-3xl font-serif mb-1",
              (lead.score || 0) >= 75
                ? "text-green-600 dark:text-green-400"
                : (lead.score || 0) >= 50
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400",
            )}>
              {lead.score || 0}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Lead Score
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 text-center">
            <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              {lead.days_in_pipeline || 0}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Days in Pipeline
            </p>
          </div>
        </div>
      </div>

      {/* Score Breakdown & History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
          <ScoreBreakdown breakdown={scoreBreakdown} />
        </div>
        <ScoreHistoryChart history={scoreHistory || []} />
      </div>

      {/* Qualification */}
      {qualificationData && (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 mb-6">
          {/* Tabs */}
          <div className="flex items-center gap-1 mb-5 border-b border-neutral-200 dark:border-neutral-800 -mx-6 px-6">
            {([
              { key: "overview" as const, label: "Overview" },
              { key: "bant" as const, label: "BANT" },
              { key: "meddic" as const, label: "MEDDIC" },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveQualTab(tab.key)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                  activeQualTab === tab.key
                    ? "border-neutral-950 dark:border-neutral-50 text-neutral-950 dark:text-neutral-50"
                    : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeQualTab === "overview" && (
            <QualificationScorecard
              data={qualificationData.qualification_data}
              grade={qualificationData.qualification_grade}
              score={qualificationData.qualification_score}
            />
          )}
          {activeQualTab === "bant" && (
            <BANTEditor
              leadId={lead.id}
              data={qualificationData.qualification_data.bant}
            />
          )}
          {activeQualTab === "meddic" && (
            <MEDDICEditor
              leadId={lead.id}
              data={qualificationData.qualification_data.meddic}
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Activity */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
              <h2 className="text-xl font-serif text-neutral-950 dark:text-neutral-50">
                Activity
              </h2>
            </div>
            <div>
              {activityItems.length > 0 ? (
                <div>
                  {activityItems.map((item) => (
                    <ActivityRow
                      key={item.id}
                      id={item.id}
                      type={item.type as ActivityRowType}
                      title={item.title}
                      description={item.description || ""}
                      onView={() => {
                        setSelectedActivity(item);
                        setShowActivityDrawer(true);
                      }}
                      onDelete={() => {}}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-neutral-500 dark:text-neutral-400">
                  <p>No activity yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
              <h2 className="text-xl font-serif text-neutral-950 dark:text-neutral-50">
                Notes
              </h2>
            </div>
            <div className="p-6">
              {leadNotes.length > 0 ? (
                <div className="space-y-6 mb-6">
                  {leadNotes.map((note) => (
                    <div key={note.id}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                          {note.author_name || "Unknown"}
                        </p>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500">
                          {formatDate(note.created_at)}
                        </p>
                      </div>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        {note.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
                  No notes yet
                </p>
              )}
              <div className="space-y-3">
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note..."
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleAddNote}
                    disabled={isPending || !newNote.trim()}
                  >
                    {isPending ? "Adding..." : "Add Note"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-4">
              Quick Actions
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowMeetingModal(true)}
                className="flex flex-col items-center gap-2 p-4 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <div className="w-10 h-10 rounded-full border border-neutral-200 dark:border-neutral-400/30 bg-white dark:bg-neutral-400/15 flex items-center justify-center">
                  <CalendarBlankIcon size={18} className="text-neutral-600 dark:text-neutral-400" />
                </div>
                <span className="text-sm font-medium text-neutral-950 dark:text-white">
                  Schedule Meeting
                </span>
              </button>
              <button
                onClick={() => setShowTaskModal(true)}
                className="flex flex-col items-center gap-2 p-4 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <div className="w-10 h-10 rounded-full border border-neutral-200 dark:border-neutral-400/30 bg-white dark:bg-neutral-400/15 flex items-center justify-center">
                  <CheckCircleIcon size={18} className="text-neutral-600 dark:text-neutral-400" />
                </div>
                <span className="text-sm font-medium text-neutral-950 dark:text-white">
                  Add Task
                </span>
              </button>
            </div>
          </div>

          {/* Contact Information */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-4">
              Contact Information
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">Email</p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">{lead.email}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">Phone</p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">{lead.phone || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">LinkedIn</p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">{lead.linkedin || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">Location</p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">{lead.location || "—"}</p>
              </div>
            </div>
          </div>

          {/* Company */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-4">
              Company
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">Company</p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">{lead.company || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">Employees</p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">{lead.employees || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">Website</p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">{lead.website || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">Industry</p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">{lead.industry || "—"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ScheduleMeetingModal
        open={showMeetingModal}
        onClose={() => setShowMeetingModal(false)}
        customerName={lead.name}
      />

      <ActivityDetailDrawer
        open={showActivityDrawer}
        onClose={() => setShowActivityDrawer(false)}
        activity={selectedActivity ? { ...selectedActivity, type: selectedActivity.type as "email" | "call" | "deal" | "meeting" | "note" | "task" | "invoice", description: selectedActivity.description ?? "" } : null}
        customerName={lead.name}
        onMarkComplete={() => {
          setShowActivityDrawer(false);
          setShowCompleteModal(true);
        }}
        onReschedule={() => {
          setShowActivityDrawer(false);
          setShowMeetingModal(true);
        }}
      />

      <CompleteMeetingModal
        open={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        onComplete={() => setShowCompleteModal(false)}
      />

      <CreateTaskModal
        open={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        customerName={lead.name}
      />

      <ConvertLeadModal
        open={showConvertModal}
        onClose={() => setShowConvertModal(false)}
        leadName={lead.name}
        onConvert={handleConvert}
      />

      <AddLeadModal
        key={showEditModal ? `edit-${lead.id}` : "closed"}
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        mode="edit"
        initialData={editLeadFormData}
        onSubmit={handleEditSubmit}
      />

      {/* AI Score Drawer */}
      <AIScoreDrawer
        isOpen={aiScoreDrawerOpen}
        onClose={() => {
          setAIScoreDrawerOpen(false);
          setAIScoreData(null);
        }}
        leadId={lead.id}
        leadName={lead.name}
        currentScore={lead.score}
        onScoreApplied={() => router.refresh()}
      />

      {/* AI Meeting Brief Modal */}
      <AIGenerateModal
        isOpen={aiBriefOpen}
        onClose={() => setAIBriefOpen(false)}
        title="AI Meeting Brief"
        description={`Generate a meeting brief for ${lead.name}`}
        onGenerate={async () => {
          const result = await aiGenerateBrief(lead.id);
          if ("error" in result) throw new Error(result.error);
          return typeof result === "string" ? result : JSON.stringify(result, null, 2);
        }}
        editable={false}
      />
    </div>
  );
}
