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
  DeleteConfirmModal,
  TrashIcon,
  UsersThreeIcon,
  PencilSimpleIcon,
  LightningIcon,
  SegmentedControl,
  type BadgeVariant,
} from "@/components/ui";
import {
  ActivityRow,
  type ActivityRowType,
  ConfirmModal,
  Page,
  PageHeader,
  MetricStrip,
  Metric,
  Section,
  DetailLayout,
  PanelSection,
  KeyValueList,
  KeyValue,
} from "@/components/dashboard";
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
import { deleteActivity } from "@/lib/actions/activities";
import { deleteCalendarEvent } from "@/lib/actions/calendar";
import { deleteRecordActivity, type LinkedItem } from "@/lib/actions/record-activities";
import { toast } from "sonner";

// --- Types matching DB rows ---

interface LeadRow {
  id: string;
  converted_at?: string | null;
  converted_customer_id?: string | null;
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
  linkedItems?: LinkedItem[];
}

// Per-record activities ("record") merged with linked org activities / calendar events.
type FeedItem = ActivityRow2 & { source: "record" | LinkedItem["source"] };

// --- Lead status config ---

const leadStatusConfig: Record<string, { label: string; variant: string }> = {
  new: { label: "New", variant: "info" },
  contacted: { label: "Contacted", variant: "warning" },
  qualified: { label: "Qualified", variant: "success" },
  proposal: { label: "Proposal", variant: "primary" },
  negotiation: { label: "Negotiation", variant: "warning" },
  won: { label: "Won", variant: "success" },
  lost: { label: "Lost", variant: "error" },
};

export function LeadDetailClient({
  lead,
  notes,
  activities,
  linkedItems,
  scoreHistory,
  qualificationData,
}: LeadDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<FeedItem | null>(null);

  const leadNotes = notes || [];
  const activityItems = useMemo<FeedItem[]>(
    () =>
      [
        ...(activities || []).map((a) => ({ ...a, source: "record" as const })),
        ...(linkedItems || []),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [activities, linkedItems],
  );

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
  const [aiScoreData, setAIScoreData] = useState<unknown>(null);
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
    source: lead.source || "",
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
    setShowDeleteConfirm(true);
  };

  const executeDelete = () => {
    setShowDeleteConfirm(false);
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

  const handleDeleteActivity = (item: FeedItem) => {
    setActivityToDelete(item);
  };

  const confirmDeleteActivity = () => {
    const item = activityToDelete;
    if (!item) return;
    setActivityToDelete(null);
    startTransition(async () => {
      const res =
        item.source === "record"
          ? await deleteRecordActivity("lead", item.id)
          : item.source === "activity"
            ? await deleteActivity(item.id)
            : await deleteCalendarEvent(item.id);
      if (res.error) {
        toast.error(res.error);
      } else {
        router.refresh();
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
        router.push(res.data ? `/dashboard/customers/${res.data.id}` : "/dashboard/customers");
      }
    });
  };

  const handleEditSubmit = async (data: LeadFormData) => {
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
      return false;
    }
    toast.success("Lead updated");
    router.refresh();
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
    <Page>
      {/* Record header */}
      <PageHeader
        title={lead.name}
        icon={<Avatar name={lead.name} size="sm" className="h-9! w-9! text-[13px]!" />}
        description={
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span>{lead.company || "—"}</span>
            <Badge variant={statusCfg.variant as BadgeVariant} dot>
              {statusCfg.label}
            </Badge>
            {lead.source && <Badge variant="neutral">{lead.source}</Badge>}
          </div>
        }
      >
        <div className="flex flex-wrap gap-2">
          {lead.phone && (
            <a href={`tel:${lead.phone}`}>
              <Button variant="outline" leftIcon={<PhoneIcon size={18} />}>
                Call
              </Button>
            </a>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`}>
              <Button variant="outline" leftIcon={<EnvelopeIcon size={18} />}>
                Email
              </Button>
            </a>
          )}
          <Button
            variant="outline"
            leftIcon={<LightningIcon size={18} />}
            onClick={handleRecalculateScore}
            disabled={isPending}
          >
            {isPending ? "Scoring..." : "Recalculate Score"}
          </Button>
          {lead.converted_at ? (
            lead.converted_customer_id ? (
              <Link href={`/dashboard/customers/${lead.converted_customer_id}`}>
                <Button leftIcon={<CheckCircleIcon size={18} />}>View Customer</Button>
              </Link>
            ) : (
              <Button leftIcon={<CheckCircleIcon size={18} />} disabled>
                Converted
              </Button>
            )
          ) : (
            <Button
              leftIcon={<UsersThreeIcon size={18} />}
              onClick={() => setShowConvertModal(true)}
            >
              Convert to Customer
            </Button>
          )}
        </div>
      </PageHeader>

      {/* AI actions */}
      <div className="flex flex-wrap items-center gap-2 px-8 pb-6 max-sm:px-4">
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

      {/* Metrics */}
      <MetricStrip>
        <Metric label="Est. Value" value={formatCurrency(lead.estimated_value || 0)} />
        <Metric label="Win Probability" value={`${lead.win_probability || 0}%`} />
        <Metric
          label="Lead Score"
          value={
            <span
              className={cn(
                (lead.score || 0) >= 75
                  ? "text-success"
                  : (lead.score || 0) >= 50
                    ? "text-warning"
                    : "text-danger",
              )}
            >
              {lead.score || 0}
            </span>
          }
        />
        <Metric label="Days in Pipeline" value={lead.days_in_pipeline || 0} />
      </MetricStrip>

      <DetailLayout
        className="border-t border-divider"
        aside={
          <>
            <PanelSection title="Quick Actions">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<CalendarBlankIcon size={16} />}
                  onClick={() => setShowMeetingModal(true)}
                >
                  Schedule Meeting
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<CheckCircleIcon size={16} />}
                  onClick={() => setShowTaskModal(true)}
                >
                  Add Task
                </Button>
              </div>
            </PanelSection>

            <PanelSection title="Contact Information">
              <KeyValueList>
                <KeyValue label="Email">{lead.email}</KeyValue>
                <KeyValue label="Phone">{lead.phone || "—"}</KeyValue>
                <KeyValue label="LinkedIn">{lead.linkedin || "—"}</KeyValue>
                <KeyValue label="Location">{lead.location || "—"}</KeyValue>
              </KeyValueList>
            </PanelSection>

            <PanelSection title="Company">
              <KeyValueList>
                <KeyValue label="Company">{lead.company || "—"}</KeyValue>
                <KeyValue label="Employees">{lead.employees || "—"}</KeyValue>
                <KeyValue label="Website">{lead.website || "—"}</KeyValue>
                <KeyValue label="Industry">{lead.industry || "—"}</KeyValue>
              </KeyValueList>
            </PanelSection>
          </>
        }
      >
        {/* Score Breakdown & History */}
        <Section>
          {scoreBreakdown || scoreHistory?.length ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ScoreBreakdown breakdown={scoreBreakdown} />
              <ScoreHistoryChart history={scoreHistory || []} />
            </div>
          ) : (
            <p className="text-[13px] text-fg-muted">No score data available</p>
          )}
        </Section>

        {/* Qualification */}
        {qualificationData && (
          <Section>
            <SegmentedControl
              options={[
                { value: "overview" as const, label: "Overview" },
                { value: "bant" as const, label: "BANT" },
                { value: "meddic" as const, label: "MEDDIC" },
              ]}
              value={activeQualTab}
              onChange={setActiveQualTab}
              className="mb-4"
            />

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
          </Section>
        )}

        {/* Activity */}
        <Section title="Activity">
          {activityItems.length > 0 ? (
            <div className="-mx-4">
              {activityItems.map((item) => (
                <ActivityRow
                  key={`${item.source}-${item.id}`}
                  id={item.id}
                  type={item.type as ActivityRowType}
                  title={item.title}
                  description={item.description || ""}
                  onView={() => {
                    setSelectedActivity(item);
                    setShowActivityDrawer(true);
                  }}
                  onDelete={() => handleDeleteActivity(item)}
                />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-fg-secondary">
              <p>No activity yet</p>
            </div>
          )}
        </Section>

        {/* Notes */}
        <Section title="Notes">
          {leadNotes.length > 0 ? (
            <div className="space-y-6 mb-6">
              {leadNotes.map((note) => (
                <div key={note.id}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-fg">
                      {note.author_name || "Unknown"}
                    </p>
                    <p className="text-xs text-fg-muted">
                      {formatDate(note.created_at)}
                    </p>
                  </div>
                  <p className="text-sm text-fg-secondary leading-relaxed">
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-fg-secondary mb-6">
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
        </Section>
      </DetailLayout>

      <ScheduleMeetingModal
        open={showMeetingModal}
        onClose={() => setShowMeetingModal(false)}
        customerName={lead.name}
        link={{ leadId: lead.id }}
        onSaved={() => router.refresh()}
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
        link={{ leadId: lead.id }}
        customerName={lead.name}
        onSaved={() => router.refresh()}
      />

      <CreateTaskModal
        open={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        customerName={lead.name}
        link={{ leadId: lead.id }}
        onSaved={() => router.refresh()}
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
      <DeleteConfirmModal
        open={activityToDelete !== null}
        onClose={() => setActivityToDelete(null)}
        onConfirm={confirmDeleteActivity}
        title="Delete this activity?"
        description="This activity will be permanently removed from the timeline. This action cannot be undone."
      />
      <ConfirmModal
        open={showDeleteConfirm}
        title="Delete Lead"
        message="Are you sure you want to delete this lead? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={executeDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </Page>
  );
}
