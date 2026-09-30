"use client";

import { useState, useTransition, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import {
  Button,
  Badge,
  Modal,
  Input,
  Select,
  Textarea,
  ActionMenu,
  Avatar,
  PlusIcon,
  ArrowLeftIcon,
  EnvelopeIcon,
  ClockIcon,
  PhoneIcon,
  CheckCircleIcon,
  CheckIcon,
  TrashIcon,
  PencilSimpleIcon,
  EyeIcon,
  XIcon,
  PaperPlaneTiltIcon,
  ChartBarIcon,
  CursorClickIcon,
  ChatCircleIcon,
  Drawer,
  SegmentedControl,
} from "@/components/ui";
import {
  Page,
  PageHeader,
  MetricStrip,
  PageTabs,
  TableSection,
  Section,
  StatCard,
  TableHeader,
  TableFooter,
  EmptyState,
} from "@/components/dashboard";
import { AIGenerateModal } from "@/components/features";
import { SparkleIcon, DotsSixVerticalIcon, MagnifyingGlassIcon, FunnelSimpleIcon } from "@/components/ui/Icons";
import {
  updateSequence,
  addSequenceStep,
  updateSequenceStep,
  deleteSequenceStep,
  enrollLead,
  updateEnrollmentStatus,
  updateSequenceSettings,
  reorderSequenceSteps,
  getLeadsForEnrollment,
  getLeadsForEnrollmentCount,
  enrollLeadsBulk,
  enrollAllMatchingLeads,
  getSequenceHeatmapData,
  getSequenceABComparison,
  getTimeToFirstReply,
  getSequenceActivityPaginated,
} from "@/lib/actions/sequences";
import type {
  SequenceKPIs,
  StepMetrics,
  DailySequenceMetrics,
  SequenceActivity,
  ABComparison,
  EnrollmentFilters,
} from "@/lib/actions/sequences";
import { aiGenerateEmail } from "@/lib/actions/ai-outreach";
import { getEmailTemplates } from "@/lib/actions/email-templates";
import { cn } from "@/lib/utils";
import { usePageHeader } from "@/hooks";
import { chartAccent, chartSuccess, chartWarning, chartGrid, chartAxis, chartTooltipStyle, axisTick } from "@/lib/design-system/chart-colors";

interface StepVariant {
  id: string;
  subject: string;
  body: string;
  weight: number;
  sent?: number;
  opened?: number;
  clicked?: number;
  replied?: number;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface SequenceRecord {
  id: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  total_steps: number;
  total_enrolled: number;
  reply_rate: number;
  created_at: string;
  [key: string]: unknown;
}

interface StepRecord {
  id: string;
  sequence_id: string;
  step_order: number;
  step_type: string;
  delay_days: number;
  subject: string | null;
  body: string | null;
  channel: string | null;
  channel_config: unknown;
  created_at: string;
  [key: string]: unknown;
}

interface EnrollmentRecord {
  id: string;
  sequence_id: string;
  lead_id: string;
  current_step: number;
  status: string;
  enrolled_at: string;
  completed_at: string | null;
  paused_at: string | null;
  leads: {
    id: string;
    name: string;
    email: string;
    company: string | null;
    score: number | null;
  } | null;
  [key: string]: unknown;
}

interface AnalyticsData {
  totalEnrolled: number;
  statusCounts: Record<string, number>;
  eventCounts: Record<string, number>;
  replyRate: number;
  totalSteps: number;
}

// ── Config ───────────────────────────────────────────────────────────────────

const statusConfig: Record<
  string,
  { label: string; variant: "neutral" | "success" | "warning" | "error" }
> = {
  draft: { label: "Draft", variant: "neutral" },
  active: { label: "Active", variant: "success" },
  paused: { label: "Paused", variant: "warning" },
  archived: { label: "Archived", variant: "error" },
};

const categoryConfig: Record<string, string> = {
  cold_outreach: "Cold Outreach",
  warm_followup: "Warm Follow-up",
  re_engagement: "Re-engagement",
  post_demo: "Post-Demo",
  nurture: "Nurture",
};

const stepTypeConfig: Record<
  string,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  email: {
    label: "Email",
    color: "text-accent-strong",
    bgColor: "bg-accent-surface",
    borderColor: "border-accent",
  },
  wait: {
    label: "Wait",
    color: "text-fg-secondary",
    bgColor: "bg-muted",
    borderColor: "border-line",
  },
  task: {
    label: "Task",
    color: "text-warning",
    bgColor: "bg-warning-surface",
    borderColor: "border-warning",
  },
  call: {
    label: "Call",
    color: "text-success",
    bgColor: "bg-success-surface",
    borderColor: "border-success",
  },
  linkedin: {
    label: "LinkedIn",
    color: "text-accent-strong",
    bgColor: "bg-accent-surface",
    borderColor: "border-accent",
  },
  whatsapp: {
    label: "WhatsApp",
    color: "text-success",
    bgColor: "bg-success-surface",
    borderColor: "border-success",
  },
  linkedin_connect: {
    label: "LinkedIn Connect",
    color: "text-accent-strong",
    bgColor: "bg-accent-surface",
    borderColor: "border-accent",
  },
  linkedin_message: {
    label: "LinkedIn Message",
    color: "text-accent-strong",
    bgColor: "bg-accent-surface",
    borderColor: "border-accent",
  },
  linkedin_view: {
    label: "Profile View",
    color: "text-accent-strong",
    bgColor: "bg-accent-surface",
    borderColor: "border-accent",
  },
  linkedin_endorse: {
    label: "Endorse",
    color: "text-accent-strong",
    bgColor: "bg-accent-surface",
    borderColor: "border-accent",
  },
};

const stepTypeOptions = [
  { label: "📧 Email", value: "email" },
  { label: "⏳ Wait", value: "wait" },
  { label: "📋 Task", value: "task" },
  { label: "📞 Call", value: "call" },
  { label: "💬 WhatsApp Message", value: "whatsapp" },
  { label: "🔗 LinkedIn Connect", value: "linkedin_connect" },
  { label: "💼 LinkedIn Message", value: "linkedin_message" },
  { label: "👁 LinkedIn Profile View", value: "linkedin_view" },
  { label: "👍 LinkedIn Endorse", value: "linkedin_endorse" },
];

const channelOptions = [
  { label: "Email", value: "email" },
  { label: "Phone", value: "phone" },
  { label: "LinkedIn", value: "linkedin" },
  { label: "WhatsApp", value: "whatsapp" },
  { label: "SMS", value: "sms" },
];

// Auto-resolve channel from step type
const getChannelForStepType = (st: string): string => {
  if (st === "whatsapp") return "whatsapp";
  if (st.startsWith("linkedin")) return "linkedin";
  if (st === "email") return "email";
  if (st === "call") return "phone";
  return "email";
};

const enrollmentStatusConfig: Record<
  string,
  { label: string; variant: "neutral" | "success" | "warning" | "error" | "info" }
> = {
  active: { label: "Active", variant: "success" },
  paused: { label: "Paused", variant: "warning" },
  completed: { label: "Completed", variant: "info" },
  replied: { label: "Replied", variant: "success" },
  bounced: { label: "Bounced", variant: "error" },
  unsubscribed: { label: "Unsubscribed", variant: "neutral" },
};

const activityEventConfig: Record<string, { label: string; color: string }> = {
  sent: { label: "Email sent to", color: "text-accent-strong" },
  opened: { label: "Email opened by", color: "text-success" },
  clicked: { label: "Link clicked by", color: "text-accent-strong" },
  replied: { label: "Reply received from", color: "text-success" },
  bounced: { label: "Email bounced for", color: "text-danger" },
};

// ── Count-Up Hook ─────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

// ── Delete Confirm Modal ─────────────────────────────────────────────────────

function StepDeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  stepLabel,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  stepLabel: string;
  isPending: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-surface">
            <TrashIcon size={20} className="text-danger" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-fg">Delete Step</h3>
            <p className="text-sm text-fg-secondary mt-0.5">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-fg-secondary">
          Are you sure you want to delete <span className="font-medium">&quot;{stepLabel}&quot;</span>?
          All associated events will be permanently removed.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 !bg-danger hover:!bg-danger !text-on-inverse" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Deleting..." : "Delete Step"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Pause Confirm Modal ──────────────────────────────────────────────────────

function PauseConfirmModal({
  open,
  onClose,
  onConfirm,
  activeCount,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  activeCount: number;
  isPending: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-surface">
            <ClockIcon size={20} className="text-warning" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-fg">Pause Sequence</h3>
            <p className="text-sm text-fg-secondary mt-0.5">Active enrollments will stop sending.</p>
          </div>
        </div>
        <p className="text-sm text-fg-secondary">
          This sequence has <span className="font-medium">{activeCount} active enrollment{activeCount !== 1 ? "s" : ""}</span>.
          Pausing will halt all scheduled emails. You can resume later.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 !bg-warning hover:!bg-warning !text-on-inverse" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Pausing..." : "Pause Sequence"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Step Icon Component ──────────────────────────────────────────────────────

function StepIcon({ type }: { type: string }) {
  const config = stepTypeConfig[type] || stepTypeConfig.email;

  const iconMap: Record<string, React.ReactNode> = {
    email: <EnvelopeIcon size={16} weight="bold" />,
    wait: <ClockIcon size={16} weight="bold" />,
    task: <CheckIcon size={16} weight="bold" />,
    call: <PhoneIcon size={16} weight="bold" />,
    linkedin: <EnvelopeIcon size={16} weight="bold" />,
  };

  return (
    <div
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full border",
        config.bgColor,
        config.borderColor,
        config.color
      )}
    >
      {iconMap[type] || iconMap.email}
    </div>
  );
}

// ── Helper: relative time ────────────────────────────────────────────────────

function relativeTime(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Component ────────────────────────────────────────────────────────────────

type TabId = "steps" | "enrolled" | "activity" | "analytics" | "settings";

interface EmailAccount {
  id: string;
  email_address: string;
  display_name: string | null;
  provider: string;
  is_default: boolean;
}

export function SequenceDetailClient({
  sequence,
  steps,
  enrollments,
  analytics,
  kpis,
  stepMetrics,
  dailyMetrics,
  recentActivity,
  emailAccounts,
}: {
  sequence: SequenceRecord;
  steps: StepRecord[];
  enrollments: EnrollmentRecord[];
  analytics: AnalyticsData | null;
  kpis: SequenceKPIs;
  stepMetrics: StepMetrics[];
  dailyMetrics: DailySequenceMetrics[];
  recentActivity: SequenceActivity[];
  emailAccounts: EmailAccount[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<TabId>("steps");

  usePageHeader({
    backHref: "/dashboard/sequences",
    breadcrumbLabel: sequence.name,
  });

  // Step modal state
  const [showStepModal, setShowStepModal] = useState(false);
  const [editingStep, setEditingStep] = useState<StepRecord | null>(null);
  const [stepType, setStepType] = useState("email");
  const [stepDelayDays, setStepDelayDays] = useState("0");
  const [stepSubject, setStepSubject] = useState("");
  const [stepBody, setStepBody] = useState("");
  const [stepChannel, setStepChannel] = useState("email");
  const [channelConfig, setChannelConfig] = useState<Record<string, unknown>>({});

  // AI Write state
  const [aiWriteOpen, setAIWriteOpen] = useState(false);
  const [aiWriteStepIndex, setAIWriteStepIndex] = useState<number | null>(null);

  // A/B Variant state
  const [showVariantB, setShowVariantB] = useState(false);
  const [variantBSubject, setVariantBSubject] = useState("");
  const [variantBBody, setVariantBBody] = useState("");
  const [variantAWeight, setVariantAWeight] = useState(50);
  const [existingVariants, setExistingVariants] = useState<StepVariant[]>([]);

  // Template picker state
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templateTarget, setTemplateTarget] = useState<"a" | "b">("a");

  const loadTemplates = async () => {
    const result = await getEmailTemplates();
    setTemplates((result.data ?? []) as EmailTemplate[]);
  };

  // Drag reorder state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // Email preview state
  const [showPreview, setShowPreview] = useState(false);

  // Bulk enrollment state
  const [showEnrollDrawer, setShowEnrollDrawer] = useState(false);
  const [enrollSearchQuery, setEnrollSearchQuery] = useState("");
  const [enrollLeadsList, setEnrollLeadsList] = useState<Array<{
    id: string; name: string; email: string; company: string | null; score: number | null; status: string;
  }>>([]);
  const [enrollSelectedIds, setEnrollSelectedIds] = useState<Set<string>>(new Set());
  const [enrollLoading, setEnrollLoading] = useState(false);
  const enrollSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [enrollStatusFilter, setEnrollStatusFilter] = useState<string>("all");
  const [enrollScoreFilter, setEnrollScoreFilter] = useState<string>("all");
  const [enrollSourceFilter, setEnrollSourceFilter] = useState<string>("all");
  const [enrollTotalCount, setEnrollTotalCount] = useState<number>(0);

  // Activity filter state
  const [activityFilter, setActivityFilter] = useState("all");
  const [activitySearch, setActivitySearch] = useState("");
  const [activityItems, setActivityItems] = useState<SequenceActivity[]>([]);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);

  // Analytics advanced state
  const [heatmapData, setHeatmapData] = useState<Array<{ day: number; hour: number; count: number }>>([]);
  const [abComparison, setAbComparison] = useState<ABComparison[]>([]);
  const [timeToReply, setTimeToReply] = useState<{ avgHours: number; medianHours: number } | null>(null);

  // Step delete confirmation state
  const [deleteStepTarget, setDeleteStepTarget] = useState<{ id: string; label: string } | null>(null);

  // Pause confirmation state
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);

  // Inline editing state (step subject)
  const [editingStepSubject, setEditingStepSubject] = useState<{ id: string; value: string } | null>(null);

  // Count-up animated KPIs
  const animEnrolled = useCountUp(kpis.totalEnrolled);
  const animSent = useCountUp(kpis.totalSent);
  const animOpened = useCountUp(kpis.totalOpened);
  const animClicked = useCountUp(kpis.totalClicked);
  const animReplied = useCountUp(kpis.totalReplied);
  const animBounced = useCountUp(kpis.totalBounced);

  // Settings state
  const seqSettings = (sequence.settings as Record<string, unknown>) ?? {};
  const [settScheduleDays, setSettScheduleDays] = useState<string[]>(
    (seqSettings.schedule_days as string[]) ?? ["mon", "tue", "wed", "thu", "fri"]
  );
  const [settStartHour, setSettStartHour] = useState(String(seqSettings.start_hour ?? "9"));
  const [settEndHour, setSettEndHour] = useState(String(seqSettings.end_hour ?? "17"));
  const [settDailyLimit, setSettDailyLimit] = useState(String(seqSettings.daily_send_limit ?? "50"));
  const [settMaxNewLeads, setSettMaxNewLeads] = useState(String(seqSettings.max_new_leads_per_day ?? "25"));
  const [settAccountIds, setSettAccountIds] = useState<string[]>(
    (seqSettings.email_account_ids as string[]) ?? []
  );
  const [settStopOnReply, setSettStopOnReply] = useState(seqSettings.stop_on_reply !== false);
  const [settStopOnBounce, setSettStopOnBounce] = useState(seqSettings.stop_on_bounce !== false);
  const [settStopOnUnsub, setSettStopOnUnsub] = useState(seqSettings.stop_on_unsubscribe !== false);
  const [settTimezone, setSettTimezone] = useState(String(seqSettings.timezone ?? "America/New_York"));

  const handleSaveSettings = () => {
    startTransition(async () => {
      const result = await updateSequenceSettings(sequence.id, {
        schedule_days: settScheduleDays,
        start_hour: parseInt(settStartHour),
        end_hour: parseInt(settEndHour),
        daily_send_limit: parseInt(settDailyLimit),
        max_new_leads_per_day: parseInt(settMaxNewLeads),
        email_account_ids: settAccountIds,
        stop_on_reply: settStopOnReply,
        stop_on_bounce: settStopOnBounce,
        stop_on_unsubscribe: settStopOnUnsub,
        timezone: settTimezone,
      });
      if (result.error) toast.error(result.error);
      else { toast.success("Settings saved"); router.refresh(); }
    });
  };

  const toggleDay = (day: string) => {
    setSettScheduleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const toggleAccount = (accId: string) => {
    setSettAccountIds((prev) =>
      prev.includes(accId) ? prev.filter((a) => a !== accId) : [...prev, accId]
    );
  };

  // Enrollment pagination
  const [enrollPage, setEnrollPage] = useState(1);
  const [enrollRowsPerPage, setEnrollRowsPerPage] = useState("10");

  const status = statusConfig[sequence.status] || statusConfig.draft;
  const categoryLabel = categoryConfig[sequence.category] || sequence.category;

  // Build step metrics map
  const stepMetricsMap = new Map<string, StepMetrics>();
  for (const sm of stepMetrics) {
    stepMetricsMap.set(sm.stepId, sm);
  }

  // Enrollment pagination
  const enrollPerPage = parseInt(enrollRowsPerPage);
  const enrollTotalPages = Math.ceil(enrollments.length / enrollPerPage);
  const enrollStartIndex = (enrollPage - 1) * enrollPerPage;
  const paginatedEnrollments = enrollments.slice(
    enrollStartIndex,
    enrollStartIndex + enrollPerPage
  );
  const enrollDisplayStart = enrollStartIndex + 1;
  const enrollDisplayEnd = Math.min(
    enrollStartIndex + enrollPerPage,
    enrollments.length
  );

  // Open add step modal
  const openAddStep = () => {
    setEditingStep(null);
    setStepType("email");
    setStepDelayDays("0");
    setStepSubject("");
    setStepBody("");
    setStepChannel("email");
    setChannelConfig({});
    setShowVariantB(false);
    setVariantBSubject("");
    setVariantBBody("");
    setVariantAWeight(50);
    setExistingVariants([]);
    setShowStepModal(true);
  };

  // Open edit step modal
  const openEditStep = (step: StepRecord) => {
    setEditingStep(step);
    setStepType(step.step_type || "email");
    setStepDelayDays(String(step.delay_days || 0));
    setStepSubject(step.subject || "");
    setStepBody(step.body || "");
    setStepChannel(step.channel || getChannelForStepType(step.step_type || "email"));
    setChannelConfig((step.channel_config as Record<string, unknown>) || {});

    // Load existing variants
    const variants = (step.variants as StepVariant[] | null) ?? [];
    setExistingVariants(variants);
    if (variants.length > 0) {
      setShowVariantB(true);
      setVariantBSubject(variants[0].subject || "");
      setVariantBBody(variants[0].body || "");
      setVariantAWeight(100 - (variants[0].weight || 50));
    } else {
      setShowVariantB(false);
      setVariantBSubject("");
      setVariantBBody("");
      setVariantAWeight(50);
    }
    setShowStepModal(true);
  };

  const handleSaveStep = () => {
    startTransition(async () => {
      // Build variants array if variant B is active
      let variants: StepVariant[] | undefined;
      if (showVariantB && variantBSubject && variantBBody && (stepType === "email" || stepType === "linkedin_message")) {
        const existingB = existingVariants[0];
        variants = [{
          id: existingB?.id || crypto.randomUUID(),
          subject: variantBSubject,
          body: variantBBody,
          weight: 100 - variantAWeight,
          sent: existingB?.sent || 0,
          opened: existingB?.opened || 0,
          clicked: existingB?.clicked || 0,
          replied: existingB?.replied || 0,
        }];
      }

      const resolvedChannel = getChannelForStepType(stepType);
      const hasConfig = Object.keys(channelConfig).length > 0;

      if (editingStep) {
        const result = await updateSequenceStep(editingStep.id, {
          step_type: stepType,
          delay_days: parseInt(stepDelayDays) || 0,
          subject: stepSubject || null,
          body: stepBody || null,
          channel: resolvedChannel,
          ...(hasConfig ? { channel_config: channelConfig } : {}),
          ...(variants !== undefined ? { variants: JSON.parse(JSON.stringify(variants)) } : {}),
          ...(!showVariantB && existingVariants.length > 0 ? { variants: [] } : {}),
        });
        if (result.error) toast.error(result.error);
        else { toast.success("Step updated"); setShowStepModal(false); router.refresh(); }
      } else {
        const result = await addSequenceStep({
          sequence_id: sequence.id,
          step_order: steps.length + 1,
          step_type: stepType,
          delay_days: parseInt(stepDelayDays) || 0,
          subject: stepSubject || undefined,
          body: stepBody || undefined,
          channel: resolvedChannel,
          ...(hasConfig ? { channel_config: channelConfig } : {}),
          ...(variants ? { variants: JSON.parse(JSON.stringify(variants)) } : {}),
        });
        if (result.error) toast.error(result.error);
        else { toast.success("Step added"); setShowStepModal(false); router.refresh(); }
      }
    });
  };

  const handleDeleteStep = (stepId: string) => {
    startTransition(async () => {
      const result = await deleteSequenceStep(stepId, sequence.id);
      if (result.error) toast.error(result.error);
      else { toast.success("Step deleted"); setDeleteStepTarget(null); router.refresh(); }
    });
  };

  // Inline subject editing handler
  const handleInlineSubjectSave = useCallback((stepId: string, newSubject: string) => {
    if (!newSubject.trim()) { setEditingStepSubject(null); return; }
    startTransition(async () => {
      const result = await updateSequenceStep(stepId, { subject: newSubject.trim() });
      if (result.error) toast.error(result.error);
      else { toast.success("Subject updated"); router.refresh(); }
      setEditingStepSubject(null);
    });
  }, [router]);

  const handleEnrollmentAction = (
    enrollmentId: string,
    action: "pause" | "resume" | "remove"
  ) => {
    const statusMap: Record<string, "active" | "paused" | "completed"> = {
      pause: "paused",
      resume: "active",
      remove: "completed",
    };

    startTransition(async () => {
      const result = await updateEnrollmentStatus(enrollmentId, statusMap[action]);
      if (result.error) toast.error(result.error);
      else {
        toast.success(
          action === "pause" ? "Enrollment paused" : action === "resume" ? "Enrollment resumed" : "Lead removed"
        );
        router.refresh();
      }
    });
  };

  // ── Phase B: Drag reorder handler ─────────────────────────────────────────
  const handleDragEnd = useCallback((fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const reordered = [...steps];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const stepIds = reordered.map((s) => s.id);
    startTransition(async () => {
      const result = await reorderSequenceSteps(sequence.id, stepIds);
      if (result.error) toast.error(result.error);
      else { toast.success("Steps reordered"); router.refresh(); }
    });
  }, [steps, sequence.id, router]);

  // ── Phase B: Merge field insertion ─────────────────────────────────────────
  const mergeFields = [
    { label: "{{first_name}}", value: "{{first_name}}" },
    { label: "{{company}}", value: "{{company}}" },
    { label: "{{email}}", value: "{{email}}" },
    { label: "{{name}}", value: "{{name}}" },
  ];

  const insertMergeField = useCallback((field: string, target: "subject" | "body") => {
    if (target === "subject") setStepSubject((prev) => prev + field);
    else setStepBody((prev) => prev + field);
  }, []);

  // ── Phase C: Bulk enrollment handlers ─────────────────────────────────────
  const loadEnrollLeads = useCallback(async (search = "", status = enrollStatusFilter, score = enrollScoreFilter, source = enrollSourceFilter) => {
    setEnrollLoading(true);
    const filters: { search?: string; status?: string; minScore?: number; source?: string } = {};
    if (search) filters.search = search;
    if (status !== "all") filters.status = status;
    if (score !== "all") filters.minScore = parseInt(score);
    if (source !== "all") filters.source = source;
    const [result, countResult] = await Promise.all([
      getLeadsForEnrollment(sequence.id, filters),
      getLeadsForEnrollmentCount(sequence.id, filters),
    ]);
    setEnrollLeadsList(result.data);
    setEnrollTotalCount(countResult.count);
    setEnrollLoading(false);
  }, [sequence.id, enrollStatusFilter, enrollScoreFilter, enrollSourceFilter]);

  const handleEnrollSearch = useCallback((value: string) => {
    setEnrollSearchQuery(value);
    if (enrollSearchTimer.current) clearTimeout(enrollSearchTimer.current);
    enrollSearchTimer.current = setTimeout(() => loadEnrollLeads(value), 300);
  }, [loadEnrollLeads]);

  const handleEnrollFilterChange = useCallback((type: "status" | "score" | "source", value: string) => {
    if (type === "status") setEnrollStatusFilter(value);
    if (type === "score") setEnrollScoreFilter(value);
    if (type === "source") setEnrollSourceFilter(value);
    // Reload with updated filter
    const status = type === "status" ? value : enrollStatusFilter;
    const score = type === "score" ? value : enrollScoreFilter;
    const source = type === "source" ? value : enrollSourceFilter;
    loadEnrollLeads(enrollSearchQuery, status, score, source);
  }, [loadEnrollLeads, enrollSearchQuery, enrollStatusFilter, enrollScoreFilter, enrollSourceFilter]);

  const handleEnrollAllMatching = useCallback(() => {
    startTransition(async () => {
      const filters: { search?: string; status?: string; minScore?: number; source?: string } = {};
      if (enrollSearchQuery) filters.search = enrollSearchQuery;
      if (enrollStatusFilter !== "all") filters.status = enrollStatusFilter;
      if (enrollScoreFilter !== "all") filters.minScore = parseInt(enrollScoreFilter);
      if (enrollSourceFilter !== "all") filters.source = enrollSourceFilter;
      const toastId = toast.loading(`Enrolling ${enrollTotalCount} matching leads...`);
      const result = await enrollAllMatchingLeads(sequence.id, filters);
      if (result.errors > 0 && result.enrolled === 0) {
        toast.error(`Failed to enroll leads (${result.errors} errors)`, { id: toastId });
      } else if (result.errors > 0 && result.enrolled > 0) {
        toast.warning(`${result.enrolled} enrolled, ${result.errors} already in sequence`, { id: toastId });
      } else if (result.enrolled === 0) {
        toast.info("All matching leads are already enrolled", { id: toastId });
      } else {
        toast.success(`${result.enrolled} leads enrolled!`, { id: toastId });
      }
      setShowEnrollDrawer(false);
      setEnrollSelectedIds(new Set());
      router.refresh();
    });
  }, [sequence.id, enrollSearchQuery, enrollStatusFilter, enrollScoreFilter, enrollSourceFilter, enrollTotalCount, router]);

  const handleBulkEnroll = useCallback(() => {
    if (enrollSelectedIds.size === 0) return;
    startTransition(async () => {
      const result = await enrollLeadsBulk(sequence.id, Array.from(enrollSelectedIds));
      if (result.errors > 0) toast.error(`${result.errors} enrollment(s) failed`);
      else {
        toast.success(`${enrollSelectedIds.size} leads enrolled`);
        setShowEnrollDrawer(false);
        setEnrollSelectedIds(new Set());
        router.refresh();
      }
    });
  }, [enrollSelectedIds, sequence.id, router]);

  // ── Phase E: Activity pagination/filter handlers ──────────────────────────
  const loadActivity = useCallback(async (eventTypes?: string[], search?: string, offset = 0) => {
    setActivityLoading(true);
    const result = await getSequenceActivityPaginated(sequence.id, {
      eventTypes: eventTypes && eventTypes.length > 0 ? eventTypes : undefined,
      search: search || undefined,
      offset,
      limit: 20,
    });
    if (offset === 0) {
      setActivityItems(result.data);
    } else {
      setActivityItems((prev) => [...prev, ...result.data]);
    }
    setActivityHasMore(result.hasMore);
    setActivityLoading(false);
  }, [sequence.id]);

  const handleActivityFilterChange = useCallback((filter: string) => {
    setActivityFilter(filter);
    const eventTypes = filter === "all" ? undefined : [filter === "sent" ? "email_sent" : filter === "opened" ? "email_opened" : filter === "clicked" ? "link_clicked" : filter === "replied" ? "email_replied" : "email_bounced"];
    loadActivity(eventTypes, activitySearch);
  }, [loadActivity, activitySearch]);

  // ── Phase D: Analytics data loader ────────────────────────────────────────
  const loadAdvancedAnalytics = useCallback(async () => {
    const [heatmap, ab, ttr] = await Promise.all([
      getSequenceHeatmapData(sequence.id),
      getSequenceABComparison(sequence.id),
      getTimeToFirstReply(sequence.id),
    ]);
    setHeatmapData(heatmap.data);
    setAbComparison(ab.data);
    setTimeToReply(ttr.data);
  }, [sequence.id]);

  const activeEnrollmentCount = enrollments.filter((e) => e.status === "active").length;

  const handleToggleStatus = () => {
    const newStatus = sequence.status === "active" ? "paused" : "active";
    // Show confirm modal when pausing with active enrollments
    if (newStatus === "paused" && activeEnrollmentCount > 0) {
      setShowPauseConfirm(true);
      return;
    }
    doPauseOrActivate(newStatus);
  };

  const doPauseOrActivate = (newStatus: string) => {
    startTransition(async () => {
      const result = await updateSequence(sequence.id, { status: newStatus as "active" | "paused" });
      if (result.error) toast.error(result.error);
      else { toast.success(`Sequence ${newStatus === "active" ? "activated" : "paused"}`); setShowPauseConfirm(false); router.refresh(); }
    });
  };

  // Tabs configuration
  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "steps", label: "Steps" },
    { id: "enrolled", label: "Enrolled Leads", count: enrollments.length },
    { id: "activity", label: "Activity" },
    { id: "analytics", label: "Analytics" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <Page>
      {/* Back Link */}
      <div className="px-8 pt-6 max-sm:px-4">
        <Link
          href="/dashboard/sequences"
          className="inline-flex items-center gap-1.5 text-[13px] text-fg-secondary hover:text-fg transition-colors"
        >
          <ArrowLeftIcon size={16} />
          Back to Sequences
        </Link>
      </div>

      {/* Record Header */}
      <PageHeader
        icon={<EnvelopeIcon size={18} />}
        title={sequence.name}
        description={
          <>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant={status.variant} dot>{status.label}</Badge>
              <span>{categoryLabel}</span>
            </div>
            {sequence.description && (
              <p className="mt-1 max-w-2xl">{sequence.description}</p>
            )}
          </>
        }
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" leftIcon={<PlusIcon size={18} weight="bold" />} onClick={openAddStep}>
            Add Step
          </Button>
          <Button
            variant="outline"
            leftIcon={<CheckCircleIcon size={18} />}
            onClick={() => { setShowEnrollDrawer(true); setEnrollStatusFilter("all"); setEnrollScoreFilter("all"); setEnrollSourceFilter("all"); loadEnrollLeads("", "all", "all", "all"); }}
          >
            Enroll Leads
          </Button>
          <Button variant="outline" onClick={handleToggleStatus} disabled={isPending}>
            {sequence.status === "active" ? "Pause" : "Activate"}
          </Button>
        </div>
      </PageHeader>

      {/* 6 KPI Metrics — Animated Count-Up */}
      <MetricStrip>
        <StatCard
          label="Enrolled"
          value={animEnrolled.toString()}
          icon={<CheckCircleIcon size={24} className="text-fg" />}
        />
        <StatCard
          label="Sent"
          value={animSent.toLocaleString()}
          icon={<PaperPlaneTiltIcon size={24} className="text-fg" />}
        />
        <StatCard
          label="Opened"
          value={`${animOpened} (${kpis.openRate}%)`}
          icon={<EnvelopeIcon size={24} className="text-fg" />}
        />
        <StatCard
          label="Clicked"
          value={`${animClicked} (${kpis.clickRate}%)`}
          icon={<CursorClickIcon size={24} className="text-fg" />}
        />
        <StatCard
          label="Replied"
          value={`${animReplied} (${kpis.replyRate}%)`}
          icon={<ChatCircleIcon size={24} className="text-fg" />}
        />
        <StatCard
          label="Bounced"
          value={`${animBounced} (${kpis.bounceRate}%)`}
          icon={<ChartBarIcon size={24} className="text-fg" />}
        />
      </MetricStrip>

      {/* Tabs */}
      <PageTabs
        tabs={tabs.map((tab) => ({
          ...tab,
          count: tab.count != null && tab.count > 0 ? `(${tab.count})` : undefined,
        }))}
        value={activeTab}
        onChange={setActiveTab}
        className="max-sm:overflow-x-auto max-sm:overflow-y-hidden"
      />

      {/* ─────────────── Tab Content with Animation ─────────────── */}
      <AnimatePresence mode="wait">
      {/* ─────────────── Steps Tab ─────────────── */}
      {activeTab === "steps" && (
        <motion.div
          key="steps"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          {steps.length > 0 ? (
            <div>
              {steps.map((step, index) => {
                const typeConfig = stepTypeConfig[step.step_type] || stepTypeConfig.email;
                const metrics = stepMetricsMap.get(step.id);

                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    className={cn(
                      "relative flex gap-4 px-8 py-4 border-b border-divider max-sm:px-4",
                      dropIndex === index && "border-t border-accent",
                    )}
                    draggable
                    onDragStart={() => setDragIndex(index)}
                    onDragOver={(e) => { e.preventDefault(); setDropIndex(index); }}
                    onDragLeave={() => setDropIndex(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragIndex !== null) handleDragEnd(dragIndex, index);
                      setDragIndex(null);
                      setDropIndex(null);
                    }}
                    onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
                  >
                    {/* Drag Handle */}
                    <div className="flex flex-col items-center pt-1 cursor-grab active:cursor-grabbing">
                      <DotsSixVerticalIcon size={16} className="text-fg-muted hover:text-fg-secondary mb-1" />
                      <StepIcon type={step.step_type} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-fg-secondary">
                              Step {step.step_order}
                            </span>
                            <Badge
                              variant={
                                step.step_type === "email" ? "info"
                                  : step.step_type === "wait" ? "neutral"
                                    : step.step_type === "task" ? "warning"
                                      : step.step_type === "call" ? "success" : "primary"
                              }
                            >
                              {typeConfig.label}
                            </Badge>
                            {step.delay_days > 0 && (
                              <Badge variant="neutral">
                                Wait {step.delay_days} day{step.delay_days !== 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>

                          {step.subject && (
                            editingStepSubject?.id === step.id ? (
                              <input
                                autoFocus
                                defaultValue={editingStepSubject.value}
                                className="text-sm font-medium text-fg bg-transparent border-b border-inverse outline-none w-full"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleInlineSubjectSave(step.id, e.currentTarget.value);
                                  if (e.key === "Escape") setEditingStepSubject(null);
                                }}
                                onBlur={(e) => handleInlineSubjectSave(step.id, e.currentTarget.value)}
                              />
                            ) : (
                              <p
                                className="text-sm font-medium text-fg cursor-text"
                                onDoubleClick={() => setEditingStepSubject({ id: step.id, value: step.subject! })}
                              >
                                {step.subject}
                              </p>
                            )
                          )}
                          {step.body && (
                            <p className="text-sm text-fg-secondary line-clamp-2">{step.body}</p>
                          )}

                          {/* Per-step metrics inline */}
                          {metrics && (step.step_type === "email" || step.step_type === "linkedin_message" || step.step_type === "whatsapp") && (
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              <span className="text-xs text-fg-muted">
                                Sent: <span className="text-fg font-medium">{metrics.sent}</span>
                              </span>
                              <span className="text-xs text-fg-muted">
                                Opened: <span className="text-success font-medium">{metrics.opened} ({metrics.openRate}%)</span>
                              </span>
                              <span className="text-xs text-fg-muted">
                                Clicked: <span className="text-accent-strong font-medium">{metrics.clicked} ({metrics.clickRate}%)</span>
                              </span>
                              <span className="text-xs text-fg-muted">
                                Replied: <span className="text-success font-medium">{metrics.replied} ({metrics.replyRate}%)</span>
                              </span>
                            </div>
                          )}

                          {/* A/B Variant comparison */}
                          {(() => {
                            const stepVariants = (step.variants as StepVariant[] | null) ?? [];
                            if (stepVariants.length === 0) return null;
                            const varB = stepVariants[0];
                            const varASent = (metrics?.sent || 0) - (varB.sent || 0);
                            const varAOpened = (metrics?.opened || 0) - (varB.opened || 0);
                            return (
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <div className="p-2 rounded border border-accent bg-accent-surface">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Badge variant="info">A</Badge>
                                    <span className="text-xs text-fg-secondary truncate">{step.subject}</span>
                                  </div>
                                  <div className="flex gap-3 text-xs text-fg-secondary">
                                    <span>Sent: <span className="font-medium text-fg">{Math.max(0, varASent)}</span></span>
                                    <span>Opens: <span className="font-medium text-success">{Math.max(0, varAOpened)}</span></span>
                                  </div>
                                </div>
                                <div className="p-2 rounded border border-accent bg-accent-surface">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Badge variant="primary">B</Badge>
                                    <span className="text-xs text-fg-secondary truncate">{varB.subject}</span>
                                  </div>
                                  <div className="flex gap-3 text-xs text-fg-secondary">
                                    <span>Sent: <span className="font-medium text-fg">{varB.sent || 0}</span></span>
                                    <span>Opens: <span className="font-medium text-success">{varB.opened || 0}</span></span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openEditStep(step)}
                            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
                          >
                            <PencilSimpleIcon size={16} className="text-fg-secondary" />
                          </button>
                          <button
                            onClick={() => setDeleteStepTarget({ id: step.id, label: step.subject || `Step ${step.step_order}` })}
                            className="flex h-8 w-8 items-center justify-center rounded hover:bg-danger-surface transition-colors"
                          >
                            <TrashIcon size={16} className="text-fg-secondary hover:text-danger" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-fg-secondary mb-4">
                No steps added yet. Add your first step to build this sequence.
              </p>
            </div>
          )}

          <div className="px-8 py-4 max-sm:px-4">
            <Button variant="outline" leftIcon={<PlusIcon size={18} weight="bold" />} onClick={openAddStep}>
              Add Step
            </Button>
          </div>
        </motion.div>
      )}

      {/* ─────────────── Enrolled Leads Tab ─────────────── */}
      {activeTab === "enrolled" && (
        <motion.div
          key="enrolled"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          <TableHeader
            title="Enrolled Leads"
            rowsPerPage={enrollRowsPerPage}
            onRowsPerPageChange={(value) => { setEnrollRowsPerPage(value); setEnrollPage(1); }}
          />

          {enrollments.length > 0 ? (
            <>
              <TableSection>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left text-[13px] font-medium text-fg-secondary">Lead</th>
                        <th className="text-left text-[13px] font-medium text-fg-secondary">Current Step</th>
                        <th className="text-left text-[13px] font-medium text-fg-secondary">Status</th>
                        <th className="text-left text-[13px] font-medium text-fg-secondary">Enrolled</th>
                        <th className="text-right text-[13px] font-medium text-fg-secondary">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedEnrollments.map((enrollment) => {
                        const lead = enrollment.leads;
                        const enrollStatus = enrollmentStatusConfig[enrollment.status] || enrollmentStatusConfig.active;

                        return (
                          <tr key={enrollment.id} className="hover:bg-subtle transition-colors">
                            <td className="py-2 text-[14px] text-fg">
                              <div className="flex items-center gap-3">
                                <Avatar name={lead?.name || "Unknown"} />
                                <div>
                                  <p className="text-sm font-medium text-fg">{lead?.name || "Unknown"}</p>
                                  <p className="text-xs text-fg-secondary">{lead?.email || "—"}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-2 text-[14px] text-fg">
                              <span className="text-sm font-semibold text-fg">
                                {enrollment.current_step} / {steps.length}
                              </span>
                            </td>
                            <td className="py-2 text-[14px] text-fg">
                              <Badge variant={enrollStatus.variant} dot>{enrollStatus.label}</Badge>
                            </td>
                            <td className="py-2 text-[14px] text-fg">
                              <span className="text-sm text-fg-secondary">
                                {new Date(enrollment.enrolled_at).toLocaleDateString()}
                              </span>
                            </td>
                            <td className="py-2 text-[14px] text-fg">
                              <div className="flex justify-end">
                                <ActionMenu
                                  items={[
                                    ...(enrollment.status === "active" ? [{
                                      label: "Pause", icon: <ClockIcon size={18} />,
                                      onClick: () => handleEnrollmentAction(enrollment.id, "pause"),
                                    }] : []),
                                    ...(enrollment.status === "paused" ? [{
                                      label: "Resume", icon: <CheckCircleIcon size={18} />,
                                      onClick: () => handleEnrollmentAction(enrollment.id, "resume"),
                                    }] : []),
                                    {
                                      label: "Remove", icon: <TrashIcon size={18} />,
                                      onClick: () => handleEnrollmentAction(enrollment.id, "remove"),
                                      variant: "danger" as const,
                                    },
                                  ]}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </TableSection>

              <TableFooter
                currentPage={enrollPage}
                totalPages={enrollTotalPages}
                totalItems={enrollments.length}
                startIndex={enrollDisplayStart}
                endIndex={enrollDisplayEnd}
                onPageChange={setEnrollPage}
                itemLabel="enrollments"
              />
            </>
          ) : (
            <EmptyState
              className="border-t border-divider"
              icon={<CheckCircleIcon size={24} />}
              title="No leads enrolled"
              description="Enroll leads from the Leads page to start this outreach sequence."
            />
          )}
        </motion.div>
      )}

      {/* ─────────────── Activity Tab (Phase E) ─────────────── */}
      {activeTab === "activity" && (
        <motion.div
          key="activity"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          <div className="flex h-14 items-center justify-between gap-4 px-8 max-sm:px-4">
            <h3 className="text-[18px] leading-6 font-semibold text-fg">Activity Feed</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <MagnifyingGlassIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={activitySearch}
                  onChange={(e) => {
                    setActivitySearch(e.target.value);
                    const types = activityFilter === "all" ? undefined : [activityFilter === "sent" ? "email_sent" : activityFilter === "opened" ? "email_opened" : activityFilter === "clicked" ? "link_clicked" : activityFilter === "replied" ? "email_replied" : "email_bounced"];
                    loadActivity(types, e.target.value);
                  }}
                  className="w-44 pl-8 pr-3 py-1.5 text-xs rounded border border-line bg-surface text-fg placeholder:text-fg-muted"
                />
              </div>
            </div>
          </div>

          {/* Filter segments */}
          <div className="flex h-12 items-center px-8 border-t border-divider max-sm:px-4 max-sm:overflow-x-auto">
            <SegmentedControl
              options={[
                { value: "all", label: "All" },
                { value: "sent", label: "Sent" },
                { value: "opened", label: "Opened" },
                { value: "clicked", label: "Clicked" },
                { value: "replied", label: "Replied" },
                { value: "bounced", label: "Bounced" },
              ]}
              value={activityFilter}
              onChange={handleActivityFilterChange}
            />
          </div>

          {/* Activity list — use filtered items if loaded, else fallback to recentActivity */}
          <TableSection>
            {(() => {
              const displayItems = activityItems.length > 0 ? activityItems : (activityFilter === "all" && !activitySearch ? recentActivity : []);
              return displayItems.length > 0 ? (
                <div>
                  {displayItems.map((event) => {
                    const config = activityEventConfig[event.eventType] || { label: event.eventType, color: "text-fg-secondary" };
                    return (
                      <Link
                        key={event.id}
                        href={`/dashboard/leads/${event.id}`}
                        className="flex min-h-11 items-center gap-3 py-2 px-8 border-b border-divider hover:bg-subtle transition-colors max-sm:px-4"
                      >
                        <div className={cn("w-2 h-2 rounded-full shrink-0", config.color.replace("text-", "bg-"))} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-fg">
                            <span className={cn("font-medium", config.color)}>{config.label}</span>{" "}
                            <span className="font-medium">{event.leadName}</span>
                            {event.stepOrder > 0 && (
                              <span className="text-fg-muted"> — Step {event.stepOrder}</span>
                            )}
                          </p>
                          {event.leadEmail && (
                            <p className="text-xs text-fg-muted truncate">{event.leadEmail}</p>
                          )}
                        </div>
                        <span className="text-xs text-fg-muted shrink-0">
                          {relativeTime(event.createdAt)}
                        </span>
                      </Link>
                    );
                  })}
                  {/* Load More */}
                  {activityHasMore && (
                    <div className="text-center py-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const types = activityFilter === "all" ? undefined : [activityFilter === "sent" ? "email_sent" : activityFilter === "opened" ? "email_opened" : activityFilter === "clicked" ? "link_clicked" : activityFilter === "replied" ? "email_replied" : "email_bounced"];
                          loadActivity(types, activitySearch, activityItems.length);
                        }}
                        disabled={activityLoading}
                      >
                        {activityLoading ? "Loading..." : "Load More"}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-fg-secondary px-8 py-8 text-center max-sm:px-4">
                  {activityFilter !== "all" || activitySearch ? "No matching activity found." : "No activity yet. Events will appear here once the sequence starts sending."}
                </p>
              );
            })()}
          </TableSection>
        </motion.div>
      )}

      {/* ─────────────── Analytics Tab (Phase D) ─────────────── */}
      {activeTab === "analytics" && (
        <motion.div
          key="analytics"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          {/* Load advanced analytics button */}
          {heatmapData.length === 0 && (
            <div className="flex justify-end px-8 pt-6 max-sm:px-4">
              <Button variant="outline" size="sm" onClick={loadAdvancedAnalytics}>
                Load Advanced Analytics
              </Button>
            </div>
          )}

          {/* Time-to-First-Reply Metrics */}
          {timeToReply && (
            <Section>
              <div className="flex flex-wrap gap-x-10 gap-y-4">
                <StatCard
                  label="Avg Time to Reply"
                  value={`${timeToReply.avgHours.toFixed(1)}h`}
                  icon={<ClockIcon size={24} className="text-fg" />}
                />
                <StatCard
                  label="Median Time to Reply"
                  value={`${timeToReply.medianHours.toFixed(1)}h`}
                  icon={<ClockIcon size={24} className="text-fg" />}
                />
              </div>
            </Section>
          )}

          {/* Funnel Chart */}
          <Section title="Conversion Funnel">
            <div className="space-y-3">
              {[
                { label: "Sent", value: kpis.totalSent, color: "bg-accent-strong" },
                { label: "Opened", value: kpis.totalOpened, color: "bg-success" },
                { label: "Clicked", value: kpis.totalClicked, color: "bg-warning" },
                { label: "Replied", value: kpis.totalReplied, color: "bg-inverse" },
              ].map((item) => {
                const maxVal = Math.max(kpis.totalSent, 1);
                const pct = Math.round((item.value / maxVal) * 100);
                return (
                  <div key={item.label} className="flex items-center gap-4">
                    <div className="w-16 shrink-0 text-sm text-fg-secondary">{item.label}</div>
                    <div className="flex-1 h-6 rounded bg-muted overflow-hidden">
                      <div className={cn("h-full rounded transition-all", item.color)} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-fg w-16 text-right">
                      {item.value} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Daily Volume Chart */}
          {dailyMetrics.length > 0 && (
            <Section title="Daily Volume (Last 14 Days)">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={dailyMetrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => new Date(v).toLocaleDateString("en", { month: "short", day: "numeric" })}
                    tick={axisTick}
                    stroke={chartAxis}
                  />
                  <YAxis tick={axisTick} stroke={chartAxis} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="sent" stroke={chartAccent} fill={chartAccent} fillOpacity={0.1} name="Sent" />
                  <Area type="monotone" dataKey="opened" stroke={chartSuccess} fill={chartSuccess} fillOpacity={0.1} name="Opened" />
                  <Area type="monotone" dataKey="replied" stroke={chartWarning} fill={chartWarning} fillOpacity={0.1} name="Replied" />
                </AreaChart>
              </ResponsiveContainer>
            </Section>
          )}

          {/* Status Breakdown */}
          <Section title="Enrollment Status Breakdown">
            {analytics?.statusCounts && Object.keys(analytics.statusCounts).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(analytics.statusCounts).map(([statusKey, count]) => {
                  const config = enrollmentStatusConfig[statusKey] || { label: statusKey, variant: "neutral" as const };
                  const percentage = kpis.totalEnrolled > 0 ? Math.round((count / kpis.totalEnrolled) * 100) : 0;

                  return (
                    <div key={statusKey} className="flex items-center gap-4">
                      <div className="w-28 shrink-0">
                        <Badge variant={config.variant} dot>{config.label}</Badge>
                      </div>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            statusKey === "active" ? "bg-success"
                              : statusKey === "paused" ? "bg-warning"
                                : statusKey === "completed" ? "bg-accent-strong"
                                  : statusKey === "replied" ? "bg-success-fill"
                                    : statusKey === "bounced" ? "bg-danger"
                                      : "bg-fg-muted"
                          )}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-fg w-12 text-right">{count}</span>
                      <span className="text-xs text-fg-secondary w-10 text-right">{percentage}%</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-fg-secondary">No enrollment data available yet.</p>
            )}
          </Section>

          {/* Best Send Time Heatmap */}
          {heatmapData.length > 0 && (
            <Section title="Best Send Time (Replies)">
              <div className="overflow-x-auto">
                <div className="grid gap-px" style={{ gridTemplateColumns: "auto repeat(24, 1fr)", minWidth: "700px" }}>
                  {/* Hour headers */}
                  <div />
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="text-xs text-fg-muted text-center pb-1">
                      {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
                    </div>
                  ))}
                  {/* Day rows */}
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayLabel, dayIdx) => (
                    <>
                      <div key={`label-${dayIdx}`} className="text-xs text-fg-muted pr-2 flex items-center">{dayLabel}</div>
                      {Array.from({ length: 24 }, (_, h) => {
                        const cell = heatmapData.find((c) => c.day === dayIdx && c.hour === h);
                        const count = cell?.count || 0;
                        const maxCount = Math.max(...heatmapData.map((c) => c.count), 1);
                        const intensity = count / maxCount;
                        return (
                          <div
                            key={`${dayIdx}-${h}`}
                            className="aspect-square rounded-sm"
                            style={{
                              backgroundColor: count > 0
                                ? `rgba(16, 185, 129, ${0.15 + intensity * 0.85})`
                                : "var(--color-neutral-100)",
                            }}
                            title={`${dayLabel} ${h}:00 — ${count} replies`}
                          />
                        );
                      })}
                    </>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {/* A/B Comparison Panel */}
          {abComparison.length > 0 && (
            <Section title="A/B Test Results">
              <div className="divide-y divide-divider">
                {abComparison.map((s) => (
                  <div key={s.stepOrder} className="py-4 first:pt-0 last:pb-0">
                    <p className="text-xs font-medium text-fg-secondary mb-3">Step {s.stepOrder}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className={cn("p-3 rounded border", s.winner === "A" ? "border-success bg-success-surface" : "border-line")}>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="info">A</Badge>
                          {s.winner === "A" && <span className="text-xs text-success font-medium">Winner</span>}
                        </div>
                        <p className="text-xs text-fg-secondary truncate mb-2">{s.subjectA || "—"}</p>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <span className="text-fg-muted">Sent: <span className="text-fg font-medium">{s.variantA.sent}</span></span>
                          <span className="text-fg-muted">Opens: <span className="text-success font-medium">{s.variantA.sent > 0 ? Math.round((s.variantA.opened / s.variantA.sent) * 100) : 0}%</span></span>
                          <span className="text-fg-muted">Clicks: <span className="text-accent-strong font-medium">{s.variantA.sent > 0 ? Math.round((s.variantA.clicked / s.variantA.sent) * 100) : 0}%</span></span>
                          <span className="text-fg-muted">Replies: <span className="text-success font-medium">{s.variantA.replyRate}%</span></span>
                        </div>
                      </div>
                      <div className={cn("p-3 rounded border", s.winner === "B" ? "border-success bg-success-surface" : "border-line")}>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="primary">B</Badge>
                          {s.winner === "B" && <span className="text-xs text-success font-medium">Winner</span>}
                        </div>
                        <p className="text-xs text-fg-secondary truncate mb-2">{s.subjectB}</p>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <span className="text-fg-muted">Sent: <span className="text-fg font-medium">{s.variantB.sent}</span></span>
                          <span className="text-fg-muted">Opens: <span className="text-success font-medium">{s.variantB.sent > 0 ? Math.round((s.variantB.opened / s.variantB.sent) * 100) : 0}%</span></span>
                          <span className="text-fg-muted">Clicks: <span className="text-accent-strong font-medium">{s.variantB.sent > 0 ? Math.round((s.variantB.clicked / s.variantB.sent) * 100) : 0}%</span></span>
                          <span className="text-fg-muted">Replies: <span className="text-success font-medium">{s.variantB.replyRate}%</span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </motion.div>
      )}

      {/* ─────────────── Settings Tab ─────────────── */}
      {activeTab === "settings" && (
        <motion.div
          key="settings"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          {/* Sending Schedule */}
          <Section title="Sending Schedule">
            <div className="max-w-[560px] space-y-4">
              <div>
                <label className="block text-sm text-fg-secondary mb-2">Active Days</label>
                <div className="flex flex-wrap gap-2">
                  {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => (
                    <button
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={cn(
                        "px-3 py-1.5 rounded text-sm font-medium transition-colors border",
                        settScheduleDays.includes(day)
                          ? "bg-accent-surface text-accent-on-surface border-accent"
                          : "bg-surface text-fg-secondary border-line hover:border-fg-muted"
                      )}
                    >
                      {day.charAt(0).toUpperCase() + day.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Start Hour"
                  value={settStartHour}
                  onChange={(e) => setSettStartHour(e.target.value)}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i.toString()} value={i.toString()}>
                      {`${i.toString().padStart(2, "0")}:00`}
                    </option>
                  ))}
                </Select>
                <Select
                  label="End Hour"
                  value={settEndHour}
                  onChange={(e) => setSettEndHour(e.target.value)}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i.toString()} value={i.toString()}>
                      {`${i.toString().padStart(2, "0")}:00`}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </Section>

          {/* Sending Limits */}
          <Section title="Sending Limits">
            <div className="grid max-w-[560px] grid-cols-2 gap-4">
              <Input
                label="Daily Send Limit"
                type="number"
                min="1"
                value={settDailyLimit}
                onChange={(e) => setSettDailyLimit(e.target.value)}
              />
              <Input
                label="Max New Leads / Day"
                type="number"
                min="1"
                value={settMaxNewLeads}
                onChange={(e) => setSettMaxNewLeads(e.target.value)}
              />
            </div>
          </Section>

          {/* Email Accounts */}
          <Section
            title="Email Accounts"
            description="Select accounts to rotate between when sending. If none selected, the default org account is used."
          >
            {emailAccounts.length > 0 ? (
              <div className="max-w-[560px] space-y-2">
                {emailAccounts.map((acc) => (
                  <label
                    key={acc.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors",
                      settAccountIds.includes(acc.id)
                        ? "border-accent bg-accent-surface text-accent-on-surface"
                        : "border-line hover:border-fg-muted"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={settAccountIds.includes(acc.id)}
                      onChange={() => toggleAccount(acc.id)}
                      className="rounded border-line text-fg focus:ring-line"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-fg">{acc.email_address}</p>
                      <p className="text-xs text-fg-secondary capitalize">{acc.provider}</p>
                    </div>
                    {acc.is_default && <Badge variant="neutral">Default</Badge>}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-fg-secondary">
                No active email accounts found. Connect an account in Settings.
              </p>
            )}
          </Section>

          {/* Stop Conditions */}
          <Section title="Stop Conditions">
            <div className="space-y-3">
              {[
                { label: "Stop on reply", value: settStopOnReply, setter: setSettStopOnReply },
                { label: "Stop on bounce", value: settStopOnBounce, setter: setSettStopOnBounce },
                { label: "Stop on unsubscribe", value: settStopOnUnsub, setter: setSettStopOnUnsub },
              ].map((item) => (
                <label key={item.label} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.value}
                    onChange={(e) => item.setter(e.target.checked)}
                    className="rounded border-line text-fg focus:ring-line"
                  />
                  <span className="text-sm text-fg">{item.label}</span>
                </label>
              ))}
            </div>
          </Section>

          {/* Timezone */}
          <Section title="Timezone">
            <div className="max-w-[560px]">
              <Select
                label="Sending Timezone"
                value={settTimezone}
                onChange={(e) => setSettTimezone(e.target.value)}
              >
                {[
                  { label: "US/Eastern (EST)", value: "America/New_York" },
                  { label: "US/Central (CST)", value: "America/Chicago" },
                  { label: "US/Mountain (MST)", value: "America/Denver" },
                  { label: "US/Pacific (PST)", value: "America/Los_Angeles" },
                  { label: "UTC", value: "UTC" },
                  { label: "Europe/London (GMT)", value: "Europe/London" },
                  { label: "Europe/Berlin (CET)", value: "Europe/Berlin" },
                  { label: "Asia/Kolkata (IST)", value: "Asia/Kolkata" },
                  { label: "Asia/Tokyo (JST)", value: "Asia/Tokyo" },
                  { label: "Australia/Sydney (AEST)", value: "Australia/Sydney" },
                ].map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          </Section>

          {/* Save Button */}
          <div className="px-8 py-6 border-t border-divider max-sm:px-4">
            <div className="flex max-w-[560px] justify-end">
              <Button onClick={handleSaveSettings} disabled={isPending}>
                {isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Step Delete Confirmation Modal */}
      <StepDeleteConfirmModal
        open={!!deleteStepTarget}
        onClose={() => setDeleteStepTarget(null)}
        onConfirm={() => deleteStepTarget && handleDeleteStep(deleteStepTarget.id)}
        stepLabel={deleteStepTarget?.label || ""}
        isPending={isPending}
      />

      {/* Pause Confirmation Modal */}
      <PauseConfirmModal
        open={showPauseConfirm}
        onClose={() => setShowPauseConfirm(false)}
        onConfirm={() => doPauseOrActivate("paused")}
        activeCount={activeEnrollmentCount}
        isPending={isPending}
      />

      {/* Add / Edit Step Modal */}
      <Modal open={showStepModal} onClose={() => setShowStepModal(false)}>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-fg">
              {editingStep ? "Edit Step" : "Add Step"}
            </h2>
            <button
              onClick={() => setShowStepModal(false)}
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
            >
              <XIcon size={20} className="text-fg-secondary" />
            </button>
          </div>

          <div className="space-y-4">
            <Select label="Step Type" required value={stepType} onChange={(e) => { setStepType(e.target.value); setStepChannel(getChannelForStepType(e.target.value)); }}>{stepTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
            <Input label="Delay (days)" type="number" min="0" placeholder="0" value={stepDelayDays} onChange={(e) => setStepDelayDays(e.target.value)} />

            {/* Channel badge */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-fg-secondary">Channel:</span>
              <Badge variant={stepType === "whatsapp" ? "success" : stepType.startsWith("linkedin") ? "info" : stepType === "email" ? "neutral" : "warning"}>
                {getChannelForStepType(stepType).charAt(0).toUpperCase() + getChannelForStepType(stepType).slice(1)}
              </Badge>
            </div>

            {/* ─── Email Step Fields ─── */}
            {stepType === "email" && (
              <>
                {showVariantB && (
                  <div className="flex items-center gap-2">
                    <Badge variant="info">Variant A ({variantAWeight}%)</Badge>
                  </div>
                )}
                <Input label="Subject" placeholder="e.g. Quick question about {{company}}" value={stepSubject} onChange={(e) => setStepSubject(e.target.value)} />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 flex-wrap">
                    {mergeFields.map((mf) => (
                      <button key={mf.value} type="button" onClick={() => insertMergeField(mf.value, "subject")} className="px-2 py-0.5 text-xs rounded-full bg-muted text-fg-secondary hover:bg-active transition-colors">
                        {mf.label}
                      </button>
                    ))}
                  </div>
                  <span className={cn("text-xs tabular-nums", stepSubject.length > 60 ? "text-danger" : stepSubject.length > 50 ? "text-warning" : "text-fg-muted")}>
                    {stepSubject.length}/60
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-fg">Body</label>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setTemplateTarget("a"); loadTemplates(); setShowTemplatePicker(true); }}>Use Template</Button>
                      <Button variant="outline" size="sm" leftIcon={<SparkleIcon size={16} />} onClick={() => setAIWriteOpen(true)}>AI Write</Button>
                    </div>
                  </div>
                  <Textarea placeholder="Write your email content..." value={stepBody} onChange={(e) => setStepBody(e.target.value)} />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 flex-wrap">
                      {mergeFields.map((mf) => (
                        <button key={mf.value} type="button" onClick={() => insertMergeField(mf.value, "body")} className="px-2 py-0.5 text-xs rounded-full bg-muted text-fg-secondary hover:bg-active transition-colors">
                          {mf.label}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => setShowPreview(!showPreview)} className="text-xs text-fg-secondary hover:text-fg transition-colors flex items-center gap-1">
                      <EyeIcon size={14} /> {showPreview ? "Hide Preview" : "Preview"}
                    </button>
                  </div>
                  {showPreview && (
                    <div className="rounded border border-line bg-subtle p-4 space-y-2">
                      <p className="text-xs font-medium text-fg-secondary">Preview with sample data:</p>
                      <p className="text-sm font-medium text-fg">
                        {stepSubject.replace(/\{\{first_name\}\}/gi, "John").replace(/\{\{name\}\}/gi, "John Smith").replace(/\{\{company\}\}/gi, "Acme Corp").replace(/\{\{email\}\}/gi, "john@acme.com")}
                      </p>
                      <div className="text-sm text-fg whitespace-pre-wrap">
                        {stepBody.replace(/\{\{first_name\}\}/gi, "John").replace(/\{\{name\}\}/gi, "John Smith").replace(/\{\{company\}\}/gi, "Acme Corp").replace(/\{\{email\}\}/gi, "john@acme.com")}
                      </div>
                    </div>
                  )}
                </div>
                {/* A/B Variant B */}
                {!showVariantB ? (
                  <button type="button" onClick={() => setShowVariantB(true)} className="flex items-center gap-2 text-sm text-fg-secondary hover:text-fg transition-colors">
                    <PlusIcon size={16} weight="bold" /> Add Variant B (A/B Test)
                  </button>
                ) : (
                  <div className="border border-dashed border-line rounded p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="primary">Variant B ({100 - variantAWeight}%)</Badge>
                      <button type="button" onClick={() => { setShowVariantB(false); setVariantBSubject(""); setVariantBBody(""); }} className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted transition-colors">
                        <XIcon size={14} className="text-fg-secondary" />
                      </button>
                    </div>
                    <Input label="Subject B" placeholder="Alternative subject line..." value={variantBSubject} onChange={(e) => setVariantBSubject(e.target.value)} />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-fg">Body B</label>
                        <Button variant="outline" size="sm" onClick={() => { setTemplateTarget("b"); loadTemplates(); setShowTemplatePicker(true); }}>Use Template</Button>
                      </div>
                      <Textarea placeholder="Alternative email body..." value={variantBBody} onChange={(e) => setVariantBBody(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-fg-secondary">Split: A {variantAWeight}% / B {100 - variantAWeight}%</label>
                      <input type="range" min={10} max={90} value={variantAWeight} onChange={(e) => setVariantAWeight(parseInt(e.target.value))} className="w-full accent-accent" />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ─── WhatsApp Step Fields ─── */}
            {stepType === "whatsapp" && (
              <div className="space-y-4 border border-success rounded p-4 bg-success-surface">
                <p className="text-xs font-medium text-success">WhatsApp Message</p>
                <p className="text-xs text-fg-secondary">
                  Business-initiated messages require pre-approved Meta templates. Free-text is only available within 24h of a customer reply.
                </p>
                <Input
                  label="Template Name (from Meta)"
                  placeholder="e.g. welcome_message"
                  value={(channelConfig.template_name as string) || ""}
                  onChange={(e) => setChannelConfig({ ...channelConfig, template_name: e.target.value })}
                />
                <Textarea
                  placeholder="Message body (for template preview/fallback)... Use {{1}}, {{2}} for template variables"
                  value={stepBody}
                  onChange={(e) => setStepBody(e.target.value)}
                />
                <div className="flex items-center gap-1 flex-wrap">
                  {mergeFields.map((mf) => (
                    <button key={mf.value} type="button" onClick={() => insertMergeField(mf.value, "body")} className="px-2 py-0.5 text-xs rounded-full bg-success-surface text-success hover:bg-success-surface transition-colors">
                      {mf.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ─── LinkedIn Connect Step ─── */}
            {stepType === "linkedin_connect" && (
              <div className="space-y-4 border border-accent rounded p-4 bg-accent-surface">
                <p className="text-xs font-medium text-accent-strong">Connection Request</p>
                <div className="space-y-2">
                  <Input
                    label="Connection Note (optional, 300 char max)"
                    placeholder="Hi {{first_name}}, I noticed we both..."
                    value={(channelConfig.connection_note as string) || ""}
                    onChange={(e) => setChannelConfig({ ...channelConfig, connection_note: e.target.value.slice(0, 300) })}
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 flex-wrap">
                      {mergeFields.map((mf) => (
                        <button key={mf.value} type="button" onClick={() => setChannelConfig({ ...channelConfig, connection_note: ((channelConfig.connection_note as string) || "") + ` ${mf.value}` })} className="px-2 py-0.5 text-xs rounded-full bg-accent-surface text-accent-on-surface hover:bg-accent-surface transition-colors">
                          {mf.label}
                        </button>
                      ))}
                    </div>
                    <span className={cn("text-xs tabular-nums", ((channelConfig.connection_note as string) || "").length > 280 ? "text-danger" : "text-fg-muted")}>
                      {((channelConfig.connection_note as string) || "").length}/300
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ─── LinkedIn Message Step ─── */}
            {stepType === "linkedin_message" && (
              <div className="space-y-4 border border-accent rounded p-4 bg-accent-surface">
                <p className="text-xs font-medium text-accent-strong">LinkedIn Message</p>
                <p className="text-xs text-fg-secondary">
                  Lead must be a 1st-degree connection. If not connected, a connection request will be sent first.
                </p>
                <Input label="Subject" placeholder="Quick question about {{company}}" value={stepSubject} onChange={(e) => setStepSubject(e.target.value)} />
                <Textarea placeholder="Write your LinkedIn message..." value={stepBody} onChange={(e) => setStepBody(e.target.value)} />
                <div className="flex items-center gap-1 flex-wrap">
                  {mergeFields.map((mf) => (
                    <button key={mf.value} type="button" onClick={() => insertMergeField(mf.value, "body")} className="px-2 py-0.5 text-xs rounded-full bg-accent-surface text-accent-on-surface hover:bg-accent-surface transition-colors">
                      {mf.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ─── LinkedIn Profile View ─── */}
            {stepType === "linkedin_view" && (
              <div className="space-y-3 border border-accent rounded p-4 bg-accent-surface">
                <p className="text-xs font-medium text-accent-strong">Profile View</p>
                <p className="text-xs text-fg-secondary">
                  Views the lead&apos;s LinkedIn profile to warm them up before a connection request. The lead will see your profile in their &quot;Who viewed your profile&quot; section.
                </p>
                <Textarea placeholder="Optional notes for this step..." value={stepBody} onChange={(e) => setStepBody(e.target.value)} />
              </div>
            )}

            {/* ─── LinkedIn Endorse ─── */}
            {stepType === "linkedin_endorse" && (
              <div className="space-y-4 border border-accent rounded p-4 bg-accent-surface">
                <p className="text-xs font-medium text-accent-strong">Skill Endorsement</p>
                <p className="text-xs text-fg-secondary">
                  Endorses a skill on the lead&apos;s profile to increase visibility and build rapport.
                </p>
                <Input
                  label="Skill to Endorse"
                  placeholder="e.g. Project Management, Python, Sales..."
                  value={(channelConfig.skill_name as string) || ""}
                  onChange={(e) => setChannelConfig({ ...channelConfig, skill_name: e.target.value })}
                />
                <Textarea placeholder="Optional notes for this step..." value={stepBody} onChange={(e) => setStepBody(e.target.value)} />
              </div>
            )}

            {/* ─── Call / Task / Wait Steps ─── */}
            {(stepType === "call" || stepType === "task" || stepType === "wait") && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-fg">
                  {stepType === "wait" ? "Notes" : stepType === "task" ? "Task Description" : "Call Script"}
                </label>
                <Textarea
                  placeholder={
                    stepType === "call" ? "Call script or talking points..."
                      : stepType === "task" ? "Describe the task..."
                        : "Add notes for this wait step..."
                  }
                  value={stepBody}
                  onChange={(e) => setStepBody(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowStepModal(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleSaveStep} disabled={isPending}>
              {isPending ? "Saving..." : editingStep ? "Update Step" : "Add Step"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* AI Write Email Modal */}
      <AIGenerateModal
        isOpen={aiWriteOpen}
        onClose={() => { setAIWriteOpen(false); setAIWriteStepIndex(null); }}
        title="AI Write Email"
        description="Generate an AI-powered email for this sequence step"
        onGenerate={async () => {
          const firstEnrolledLead = enrollments.find((e) => e.leads)?.leads;
          if (!firstEnrolledLead) {
            throw new Error("No enrolled leads found. Enroll a lead first to generate personalized emails.");
          }
          const result = await aiGenerateEmail(firstEnrolledLead.id);
          if ("error" in result) throw new Error(result.error);
          return `Subject: ${result.subject}\n\n${result.body}`;
        }}
        onApply={(content) => {
          const lines = content.split("\n");
          const subjectLine = lines[0] || "";
          const subject = subjectLine.startsWith("Subject: ") ? subjectLine.slice(9) : subjectLine;
          const body = lines.slice(2).join("\n").trim();
          setStepSubject(subject);
          setStepBody(body);
          setAIWriteOpen(false);
          setAIWriteStepIndex(null);
        }}
        applyLabel="Use Email"
        editable={true}
      />

      {/* Template Picker Modal */}
      <Modal open={showTemplatePicker} onClose={() => setShowTemplatePicker(false)}>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-fg">Select Template</h2>
            <button
              onClick={() => setShowTemplatePicker(false)}
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
            >
              <XIcon size={20} className="text-fg-secondary" />
            </button>
          </div>
          {templates.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => {
                    if (templateTarget === "a") {
                      setStepSubject(tpl.subject);
                      setStepBody(tpl.body);
                    } else {
                      setVariantBSubject(tpl.subject);
                      setVariantBBody(tpl.body);
                    }
                    setShowTemplatePicker(false);
                    toast.success(`Template "${tpl.name}" applied`);
                  }}
                  className="w-full text-left p-3 rounded border border-line hover:border-fg-muted transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-fg">{tpl.name}</p>
                    <Badge variant="neutral">{tpl.category}</Badge>
                  </div>
                  <p className="text-xs text-fg-secondary line-clamp-1">{tpl.subject}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-fg-secondary text-center py-8">
              No templates found. Create templates in the email section first.
            </p>
          )}
        </div>
      </Modal>

      {/* ─────── Bulk Enrollment Drawer (Phase C) ─────── */}
      <Drawer
        open={showEnrollDrawer}
        onClose={() => setShowEnrollDrawer(false)}
        title="Enroll Leads"
        footer={
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-fg-secondary">
              {enrollSelectedIds.size} selected · {enrollTotalCount} total matching
            </span>
            <div className="flex gap-2">
              {enrollTotalCount > 0 && (
                <Button
                  variant="outline"
                  onClick={handleEnrollAllMatching}
                  disabled={isPending || enrollTotalCount === 0}
                >
                  {isPending ? "Enrolling..." : `Enroll All ${enrollTotalCount}`}
                </Button>
              )}
              <Button
                onClick={handleBulkEnroll}
                disabled={isPending || enrollSelectedIds.size === 0}
              >
                {isPending ? "Enrolling..." : `Enroll ${enrollSelectedIds.size} Selected`}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
            <input
              type="text"
              placeholder="Search leads by name, email, or company..."
              value={enrollSearchQuery}
              onChange={(e) => handleEnrollSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded border border-line bg-surface text-fg placeholder:text-fg-muted"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <select
              value={enrollStatusFilter}
              onChange={(e) => handleEnrollFilterChange("status", e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs rounded border border-line bg-surface text-fg"
            >
              <option value="all">All Status</option>
              <option value="hot">Hot</option>
              <option value="warm">Warm</option>
              <option value="cold">Cold</option>
              <option value="new">New</option>
            </select>
            <select
              value={enrollScoreFilter}
              onChange={(e) => handleEnrollFilterChange("score", e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs rounded border border-line bg-surface text-fg"
            >
              <option value="all">Any Score</option>
              <option value="90">90+</option>
              <option value="70">70+</option>
              <option value="50">50+</option>
              <option value="30">30+</option>
            </select>
            <select
              value={enrollSourceFilter}
              onChange={(e) => handleEnrollFilterChange("source", e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs rounded border border-line bg-surface text-fg"
            >
              <option value="all">All Sources</option>
              <option value="Website">Website</option>
              <option value="LinkedIn">LinkedIn</option>
              <option value="Referral">Referral</option>
              <option value="Cold Outreach">Cold Outreach</option>
              <option value="Event">Event</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Select All */}
          {enrollLeadsList.length > 0 && (
            <button
              onClick={() => {
                if (enrollSelectedIds.size === enrollLeadsList.length) {
                  setEnrollSelectedIds(new Set());
                } else {
                  setEnrollSelectedIds(new Set(enrollLeadsList.map((l) => l.id)));
                }
              }}
              className="text-xs font-medium text-fg-secondary hover:text-fg transition-colors"
            >
              {enrollSelectedIds.size === enrollLeadsList.length ? "Deselect All" : `Select All (${enrollLeadsList.length})`}
            </button>
          )}

          {/* Lead List */}
          {enrollLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 rounded bg-muted animate-pulse" />
              ))}
            </div>
          ) : enrollLeadsList.length > 0 ? (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {enrollLeadsList.map((lead) => (
                <label
                  key={lead.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors",
                    enrollSelectedIds.has(lead.id)
                      ? "border-accent bg-accent-surface text-accent-on-surface"
                      : "border-line hover:border-fg-muted",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={enrollSelectedIds.has(lead.id)}
                    onChange={() => {
                      setEnrollSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(lead.id)) next.delete(lead.id);
                        else next.add(lead.id);
                        return next;
                      });
                    }}
                    className="rounded border-line text-fg focus:ring-line"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-fg">{lead.name}</p>
                    <p className="text-xs text-fg-secondary truncate">{lead.email}</p>
                  </div>
                  {lead.score != null && (
                    <Badge variant={lead.score >= 70 ? "success" : lead.score >= 40 ? "warning" : "neutral"}>
                      {lead.score}
                    </Badge>
                  )}
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-fg-secondary text-center py-8">
              {enrollSearchQuery ? "No matching leads found." : "No leads available to enroll."}
            </p>
          )}
        </div>
      </Drawer>
    </Page>
  );
}
