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
} from "@/components/ui";
import { PageHeader, StatCard, TableHeader, TableFooter, EmptyState } from "@/components/dashboard";
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
  enrollLeadsBulk,
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
} from "@/lib/actions/sequences";
import { aiGenerateEmail } from "@/lib/actions/ai-outreach";
import { getEmailTemplates } from "@/lib/actions/email-templates";
import { cn } from "@/lib/utils";

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
  { label: string; variant: "neutral" | "green" | "amber" | "red" }
> = {
  draft: { label: "Draft", variant: "neutral" },
  active: { label: "Active", variant: "green" },
  paused: { label: "Paused", variant: "amber" },
  archived: { label: "Archived", variant: "red" },
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
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-400/15",
    borderColor: "border-blue-200 dark:border-blue-400/30",
  },
  wait: {
    label: "Wait",
    color: "text-neutral-600 dark:text-neutral-400",
    bgColor: "bg-neutral-100 dark:bg-neutral-400/15",
    borderColor: "border-neutral-200 dark:border-neutral-400/30",
  },
  task: {
    label: "Task",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-400/15",
    borderColor: "border-amber-200 dark:border-amber-400/30",
  },
  call: {
    label: "Call",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-400/15",
    borderColor: "border-green-200 dark:border-green-400/30",
  },
  linkedin: {
    label: "LinkedIn",
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-100 dark:bg-violet-400/15",
    borderColor: "border-violet-200 dark:border-violet-400/30",
  },
  whatsapp: {
    label: "WhatsApp",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-400/15",
    borderColor: "border-emerald-200 dark:border-emerald-400/30",
  },
  linkedin_connect: {
    label: "LinkedIn Connect",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-400/15",
    borderColor: "border-blue-200 dark:border-blue-400/30",
  },
  linkedin_message: {
    label: "LinkedIn Message",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-400/15",
    borderColor: "border-blue-200 dark:border-blue-400/30",
  },
  linkedin_view: {
    label: "Profile View",
    color: "text-sky-600 dark:text-sky-400",
    bgColor: "bg-sky-100 dark:bg-sky-400/15",
    borderColor: "border-sky-200 dark:border-sky-400/30",
  },
  linkedin_endorse: {
    label: "Endorse",
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-100 dark:bg-indigo-400/15",
    borderColor: "border-indigo-200 dark:border-indigo-400/30",
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
  { label: string; variant: "neutral" | "green" | "amber" | "red" | "blue" }
> = {
  active: { label: "Active", variant: "green" },
  paused: { label: "Paused", variant: "amber" },
  completed: { label: "Completed", variant: "blue" },
  replied: { label: "Replied", variant: "green" },
  bounced: { label: "Bounced", variant: "red" },
  unsubscribed: { label: "Unsubscribed", variant: "neutral" },
};

const activityEventConfig: Record<string, { label: string; color: string }> = {
  sent: { label: "Email sent to", color: "text-blue-500" },
  opened: { label: "Email opened by", color: "text-green-500" },
  clicked: { label: "Link clicked by", color: "text-violet-500" },
  replied: { label: "Reply received from", color: "text-emerald-500" },
  bounced: { label: "Email bounced for", color: "text-red-500" },
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
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <TrashIcon size={20} className="text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-serif text-neutral-950 dark:text-neutral-50">Delete Step</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          Are you sure you want to delete <span className="font-medium">&quot;{stepLabel}&quot;</span>?
          All associated events will be permanently removed.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 !bg-red-600 hover:!bg-red-700 !text-white" onClick={onConfirm} disabled={isPending}>
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
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <ClockIcon size={20} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-serif text-neutral-950 dark:text-neutral-50">Pause Sequence</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Active enrollments will stop sending.</p>
          </div>
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          This sequence has <span className="font-medium">{activeCount} active enrollment{activeCount !== 1 ? "s" : ""}</span>.
          Pausing will halt all scheduled emails. You can resume later.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 !bg-amber-600 hover:!bg-amber-700 !text-white" onClick={onConfirm} disabled={isPending}>
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
  const loadEnrollLeads = useCallback(async (search = "") => {
    setEnrollLoading(true);
    const result = await getLeadsForEnrollment(sequence.id, { search: search || undefined });
    setEnrollLeadsList(result.data);
    setEnrollLoading(false);
  }, [sequence.id]);

  const handleEnrollSearch = useCallback((value: string) => {
    setEnrollSearchQuery(value);
    if (enrollSearchTimer.current) clearTimeout(enrollSearchTimer.current);
    enrollSearchTimer.current = setTimeout(() => loadEnrollLeads(value), 300);
  }, [loadEnrollLeads]);

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
    <div className="py-6 px-4 sm:px-6 lg:px-8 space-y-4">
      {/* Back Link + Header */}
      <div className="space-y-3">
        <Link
          href="/dashboard/sequences"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors"
        >
          <ArrowLeftIcon size={16} />
          Back to Sequences
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-[28px] leading-[36px] tracking-[-0.56px] font-serif text-neutral-950 dark:text-neutral-50">
              {sequence.name}
            </h1>
            <Badge variant={status.variant} dot>{status.label}</Badge>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">{categoryLabel}</span>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" leftIcon={<PlusIcon size={18} weight="bold" />} onClick={openAddStep}>
              Add Step
            </Button>
            <Button
              variant="outline"
              leftIcon={<CheckCircleIcon size={18} />}
              onClick={() => { setShowEnrollDrawer(true); loadEnrollLeads(); }}
            >
              Enroll Leads
            </Button>
            <Button variant="outline" onClick={handleToggleStatus} disabled={isPending}>
              {sequence.status === "active" ? "Pause" : "Activate"}
            </Button>
          </div>
        </div>

        {sequence.description && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">{sequence.description}</p>
        )}
      </div>

      {/* 6 KPI Stat Cards — Animated Count-Up */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Enrolled"
          value={animEnrolled.toString()}
          icon={<CheckCircleIcon size={24} className="text-neutral-950 dark:text-neutral-50" />}
        />
        <StatCard
          label="Sent"
          value={animSent.toLocaleString()}
          icon={<PaperPlaneTiltIcon size={24} className="text-neutral-950 dark:text-neutral-50" />}
        />
        <StatCard
          label="Opened"
          value={`${animOpened} (${kpis.openRate}%)`}
          icon={<EnvelopeIcon size={24} className="text-neutral-950 dark:text-neutral-50" />}
        />
        <StatCard
          label="Clicked"
          value={`${animClicked} (${kpis.clickRate}%)`}
          icon={<CursorClickIcon size={24} className="text-neutral-950 dark:text-neutral-50" />}
        />
        <StatCard
          label="Replied"
          value={`${animReplied} (${kpis.replyRate}%)`}
          icon={<ChatCircleIcon size={24} className="text-neutral-950 dark:text-neutral-50" />}
        />
        <StatCard
          label="Bounced"
          value={`${animBounced} (${kpis.bounceRate}%)`}
          icon={<ChartBarIcon size={24} className="text-neutral-950 dark:text-neutral-50" />}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-1.5 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded transition-colors",
              activeTab === tab.id
                ? "bg-neutral-950 dark:bg-white text-white dark:text-neutral-950"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            )}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className="ml-1.5 text-xs opacity-60">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

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
          className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6"
        >
          {steps.length > 0 ? (
            <div className="space-y-0">
              {steps.map((step, index) => {
                const typeConfig = stepTypeConfig[step.step_type] || stepTypeConfig.email;
                const isLast = index === steps.length - 1;
                const metrics = stepMetricsMap.get(step.id);

                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    className={cn(
                      "relative flex gap-4",
                      dropIndex === index && "border-t-2 border-blue-500",
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
                      <DotsSixVerticalIcon size={16} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 mb-1" />
                      <StepIcon type={step.step_type} />
                      {!isLast && <div className="w-px flex-1 bg-neutral-200 dark:bg-neutral-800 my-1" />}
                    </div>

                    <div className={cn("flex-1 pb-6", isLast && "pb-0")}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">
                              Step {step.step_order}
                            </span>
                            <Badge
                              variant={
                                step.step_type === "email" ? "blue"
                                  : step.step_type === "wait" ? "neutral"
                                    : step.step_type === "task" ? "amber"
                                      : step.step_type === "call" ? "green" : "violet"
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
                                className="text-sm font-medium text-neutral-950 dark:text-neutral-50 bg-transparent border-b-2 border-neutral-950 dark:border-white outline-none w-full"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleInlineSubjectSave(step.id, e.currentTarget.value);
                                  if (e.key === "Escape") setEditingStepSubject(null);
                                }}
                                onBlur={(e) => handleInlineSubjectSave(step.id, e.currentTarget.value)}
                              />
                            ) : (
                              <p
                                className="text-sm font-medium text-neutral-950 dark:text-neutral-50 cursor-text"
                                onDoubleClick={() => setEditingStepSubject({ id: step.id, value: step.subject! })}
                              >
                                {step.subject}
                              </p>
                            )
                          )}
                          {step.body && (
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2">{step.body}</p>
                          )}

                          {/* Per-step metrics inline */}
                          {metrics && (step.step_type === "email" || step.step_type === "linkedin_message" || step.step_type === "whatsapp") && (
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              <span className="text-xs text-neutral-400 dark:text-neutral-500">
                                Sent: <span className="text-neutral-950 dark:text-neutral-50 font-medium">{metrics.sent}</span>
                              </span>
                              <span className="text-xs text-neutral-400 dark:text-neutral-500">
                                Opened: <span className="text-green-600 dark:text-green-400 font-medium">{metrics.opened} ({metrics.openRate}%)</span>
                              </span>
                              <span className="text-xs text-neutral-400 dark:text-neutral-500">
                                Clicked: <span className="text-violet-600 dark:text-violet-400 font-medium">{metrics.clicked} ({metrics.clickRate}%)</span>
                              </span>
                              <span className="text-xs text-neutral-400 dark:text-neutral-500">
                                Replied: <span className="text-emerald-600 dark:text-emerald-400 font-medium">{metrics.replied} ({metrics.replyRate}%)</span>
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
                                <div className="p-2 rounded border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Badge variant="blue">A</Badge>
                                    <span className="text-xs text-neutral-500 truncate">{step.subject}</span>
                                  </div>
                                  <div className="flex gap-3 text-xs text-neutral-500">
                                    <span>Sent: <span className="font-medium text-neutral-950 dark:text-neutral-50">{Math.max(0, varASent)}</span></span>
                                    <span>Opens: <span className="font-medium text-green-600">{Math.max(0, varAOpened)}</span></span>
                                  </div>
                                </div>
                                <div className="p-2 rounded border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/30">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Badge variant="violet">B</Badge>
                                    <span className="text-xs text-neutral-500 truncate">{varB.subject}</span>
                                  </div>
                                  <div className="flex gap-3 text-xs text-neutral-500">
                                    <span>Sent: <span className="font-medium text-neutral-950 dark:text-neutral-50">{varB.sent || 0}</span></span>
                                    <span>Opens: <span className="font-medium text-green-600">{varB.opened || 0}</span></span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openEditStep(step)}
                            className="flex h-8 w-8 items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                          >
                            <PencilSimpleIcon size={16} className="text-neutral-500" />
                          </button>
                          <button
                            onClick={() => setDeleteStepTarget({ id: step.id, label: step.subject || `Step ${step.step_order}` })}
                            className="flex h-8 w-8 items-center justify-center rounded hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          >
                            <TrashIcon size={16} className="text-neutral-500 hover:text-red-500" />
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
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
                No steps added yet. Add your first step to build this sequence.
              </p>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800">
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
          className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden"
        >
          <TableHeader
            title="Enrolled Leads"
            rowsPerPage={enrollRowsPerPage}
            onRowsPerPageChange={(value) => { setEnrollRowsPerPage(value); setEnrollPage(1); }}
          />

          {enrollments.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-[0.5px] border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
                      <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3">Lead</th>
                      <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">Current Step</th>
                      <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">Status</th>
                      <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">Enrolled</th>
                      <th className="text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 px-3 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedEnrollments.map((enrollment) => {
                      const lead = enrollment.leads;
                      const enrollStatus = enrollmentStatusConfig[enrollment.status] || enrollmentStatusConfig.active;

                      return (
                        <tr key={enrollment.id} className="border-b-[0.5px] border-neutral-200 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar name={lead?.name || "Unknown"} />
                              <div>
                                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">{lead?.name || "Unknown"}</p>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">{lead?.email || "—"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                            <span className="text-sm font-medium font-serif text-neutral-950 dark:text-neutral-50">
                              {enrollment.current_step} / {steps.length}
                            </span>
                          </td>
                          <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                            <Badge variant={enrollStatus.variant} dot>{enrollStatus.label}</Badge>
                          </td>
                          <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                            <span className="text-sm text-neutral-500 dark:text-neutral-400">
                              {new Date(enrollment.enrolled_at).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="px-3 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                            <div className="flex justify-center">
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
            <div className="py-16 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center mb-5">
                <CheckCircleIcon size={24} className="text-neutral-950 dark:text-neutral-50" />
              </div>
              <h3 className="text-2xl font-serif text-neutral-950 dark:text-neutral-50 mb-2">No leads enrolled</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-xs">
                Enroll leads from the Leads page to start this outreach sequence.
              </p>
            </div>
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
          className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="text-sm font-medium text-neutral-950 dark:text-neutral-50">Activity Feed</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <MagnifyingGlassIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={activitySearch}
                  onChange={(e) => {
                    setActivitySearch(e.target.value);
                    const types = activityFilter === "all" ? undefined : [activityFilter === "sent" ? "email_sent" : activityFilter === "opened" ? "email_opened" : activityFilter === "clicked" ? "link_clicked" : activityFilter === "replied" ? "email_replied" : "email_bounced"];
                    loadActivity(types, e.target.value);
                  }}
                  className="w-44 pl-8 pr-3 py-1.5 text-xs rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-950 dark:text-neutral-50 placeholder:text-neutral-400"
                />
              </div>
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1.5 mb-4 flex-wrap">
            {[
              { id: "all", label: "All" },
              { id: "sent", label: "Sent" },
              { id: "opened", label: "Opened" },
              { id: "clicked", label: "Clicked" },
              { id: "replied", label: "Replied" },
              { id: "bounced", label: "Bounced" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => handleActivityFilterChange(f.id)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-full transition-colors",
                  activityFilter === f.id
                    ? "bg-neutral-950 dark:bg-white text-white dark:text-neutral-950"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Activity list — use filtered items if loaded, else fallback to recentActivity */}
          {(() => {
            const displayItems = activityItems.length > 0 ? activityItems : (activityFilter === "all" && !activitySearch ? recentActivity : []);
            return displayItems.length > 0 ? (
              <div className="space-y-3">
                {displayItems.map((event) => {
                  const config = activityEventConfig[event.eventType] || { label: event.eventType, color: "text-neutral-500" };
                  return (
                    <Link
                      key={event.id}
                      href={`/dashboard/leads/${event.id}`}
                      className="flex items-center gap-3 py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded px-2 -mx-2 transition-colors"
                    >
                      <div className={cn("w-2 h-2 rounded-full shrink-0", config.color.replace("text-", "bg-"))} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-neutral-950 dark:text-neutral-50">
                          <span className={cn("font-medium", config.color)}>{config.label}</span>{" "}
                          <span className="font-medium">{event.leadName}</span>
                          {event.stepOrder > 0 && (
                            <span className="text-neutral-400 dark:text-neutral-500"> — Step {event.stepOrder}</span>
                          )}
                        </p>
                        {event.leadEmail && (
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 truncate">{event.leadEmail}</p>
                        )}
                      </div>
                      <span className="text-xs text-neutral-400 dark:text-neutral-500 shrink-0">
                        {relativeTime(event.createdAt)}
                      </span>
                    </Link>
                  );
                })}
                {/* Load More */}
                {activityHasMore && (
                  <div className="text-center pt-2">
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
              <p className="text-sm text-neutral-500 dark:text-neutral-400 py-8 text-center">
                {activityFilter !== "all" || activitySearch ? "No matching activity found." : "No activity yet. Events will appear here once the sequence starts sending."}
              </p>
            );
          })()}
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
          className="space-y-4"
        >
          {/* Load advanced analytics button */}
          {heatmapData.length === 0 && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={loadAdvancedAnalytics}>
                Load Advanced Analytics
              </Button>
            </div>
          )}

          {/* Time-to-First-Reply Card */}
          {timeToReply && (
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                label="Avg Time to Reply"
                value={`${timeToReply.avgHours.toFixed(1)}h`}
                icon={<ClockIcon size={24} className="text-neutral-950 dark:text-neutral-50" />}
              />
              <StatCard
                label="Median Time to Reply"
                value={`${timeToReply.medianHours.toFixed(1)}h`}
                icon={<ClockIcon size={24} className="text-neutral-950 dark:text-neutral-50" />}
              />
            </div>
          )}

          {/* Funnel Chart */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
            <h3 className="text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-4">Conversion Funnel</h3>
            <div className="space-y-3">
              {[
                { label: "Sent", value: kpis.totalSent, color: "bg-blue-500" },
                { label: "Opened", value: kpis.totalOpened, color: "bg-green-500" },
                { label: "Clicked", value: kpis.totalClicked, color: "bg-violet-500" },
                { label: "Replied", value: kpis.totalReplied, color: "bg-emerald-500" },
              ].map((item) => {
                const maxVal = Math.max(kpis.totalSent, 1);
                const pct = Math.round((item.value / maxVal) * 100);
                return (
                  <div key={item.label} className="flex items-center gap-4">
                    <div className="w-16 shrink-0 text-sm text-neutral-500 dark:text-neutral-400">{item.label}</div>
                    <div className="flex-1 h-6 rounded bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                      <div className={cn("h-full rounded transition-all", item.color)} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-medium font-serif text-neutral-950 dark:text-neutral-50 w-16 text-right">
                      {item.value} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily Volume Chart */}
          {dailyMetrics.length > 0 && (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
              <h3 className="text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-4">
                Daily Volume (Last 14 Days)
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={dailyMetrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => new Date(v).toLocaleDateString("en", { month: "short", day: "numeric" })}
                    tick={{ fontSize: 12 }}
                    stroke="#a3a3a3"
                  />
                  <YAxis tick={{ fontSize: 12 }} stroke="#a3a3a3" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e5e5e5",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="sent" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} name="Sent" />
                  <Area type="monotone" dataKey="opened" stroke="#22c55e" fill="#22c55e" fillOpacity={0.1} name="Opened" />
                  <Area type="monotone" dataKey="replied" stroke="#10b981" fill="#10b981" fillOpacity={0.1} name="Replied" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Status Breakdown */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
            <h3 className="text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-4">
              Enrollment Status Breakdown
            </h3>
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
                      <div className="flex-1 h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            statusKey === "active" ? "bg-green-500"
                              : statusKey === "paused" ? "bg-amber-500"
                                : statusKey === "completed" ? "bg-blue-500"
                                  : statusKey === "replied" ? "bg-green-400"
                                    : statusKey === "bounced" ? "bg-red-500"
                                      : "bg-neutral-400"
                          )}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium font-serif text-neutral-950 dark:text-neutral-50 w-12 text-right">{count}</span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 w-10 text-right">{percentage}%</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">No enrollment data available yet.</p>
            )}
          </div>

          {/* Best Send Time Heatmap */}
          {heatmapData.length > 0 && (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
              <h3 className="text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-4">Best Send Time (Replies)</h3>
              <div className="overflow-x-auto">
                <div className="grid gap-px" style={{ gridTemplateColumns: "auto repeat(24, 1fr)", minWidth: "700px" }}>
                  {/* Hour headers */}
                  <div />
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="text-[10px] text-neutral-400 text-center pb-1">
                      {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
                    </div>
                  ))}
                  {/* Day rows */}
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayLabel, dayIdx) => (
                    <>
                      <div key={`label-${dayIdx}`} className="text-[10px] text-neutral-400 pr-2 flex items-center">{dayLabel}</div>
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
            </div>
          )}

          {/* A/B Comparison Panel */}
          {abComparison.length > 0 && (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
              <h3 className="text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-4">A/B Test Results</h3>
              <div className="space-y-4">
                {abComparison.map((s) => (
                  <div key={s.stepOrder} className="border border-neutral-200 dark:border-neutral-700 rounded p-4">
                    <p className="text-xs font-medium text-neutral-500 mb-3">Step {s.stepOrder}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className={cn("p-3 rounded border", s.winner === "A" ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20" : "border-neutral-200 dark:border-neutral-700")}>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="blue">A</Badge>
                          {s.winner === "A" && <span className="text-xs text-green-600 dark:text-green-400 font-medium">Winner</span>}
                        </div>
                        <p className="text-xs text-neutral-500 truncate mb-2">{s.subjectA || "—"}</p>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <span className="text-neutral-400">Sent: <span className="text-neutral-950 dark:text-neutral-50 font-medium">{s.variantA.sent}</span></span>
                          <span className="text-neutral-400">Opens: <span className="text-green-600 font-medium">{s.variantA.sent > 0 ? Math.round((s.variantA.opened / s.variantA.sent) * 100) : 0}%</span></span>
                          <span className="text-neutral-400">Clicks: <span className="text-violet-600 font-medium">{s.variantA.sent > 0 ? Math.round((s.variantA.clicked / s.variantA.sent) * 100) : 0}%</span></span>
                          <span className="text-neutral-400">Replies: <span className="text-emerald-600 font-medium">{s.variantA.replyRate}%</span></span>
                        </div>
                      </div>
                      <div className={cn("p-3 rounded border", s.winner === "B" ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20" : "border-neutral-200 dark:border-neutral-700")}>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="violet">B</Badge>
                          {s.winner === "B" && <span className="text-xs text-green-600 dark:text-green-400 font-medium">Winner</span>}
                        </div>
                        <p className="text-xs text-neutral-500 truncate mb-2">{s.subjectB}</p>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <span className="text-neutral-400">Sent: <span className="text-neutral-950 dark:text-neutral-50 font-medium">{s.variantB.sent}</span></span>
                          <span className="text-neutral-400">Opens: <span className="text-green-600 font-medium">{s.variantB.sent > 0 ? Math.round((s.variantB.opened / s.variantB.sent) * 100) : 0}%</span></span>
                          <span className="text-neutral-400">Clicks: <span className="text-violet-600 font-medium">{s.variantB.sent > 0 ? Math.round((s.variantB.clicked / s.variantB.sent) * 100) : 0}%</span></span>
                          <span className="text-neutral-400">Replies: <span className="text-emerald-600 font-medium">{s.variantB.replyRate}%</span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
          className="space-y-4"
        >
          {/* Sending Schedule */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
            <h3 className="text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-4">Sending Schedule</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-500 dark:text-neutral-400 mb-2">Active Days</label>
                <div className="flex flex-wrap gap-2">
                  {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => (
                    <button
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={cn(
                        "px-3 py-1.5 rounded text-sm font-medium transition-colors border",
                        settScheduleDays.includes(day)
                          ? "bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 border-neutral-950 dark:border-white"
                          : "bg-white dark:bg-neutral-950 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:border-neutral-400"
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
                  options={Array.from({ length: 24 }, (_, i) => ({
                    label: `${i.toString().padStart(2, "0")}:00`,
                    value: i.toString(),
                  }))}
                  value={settStartHour}
                  onChange={(e) => setSettStartHour(e.target.value)}
                />
                <Select
                  label="End Hour"
                  options={Array.from({ length: 24 }, (_, i) => ({
                    label: `${i.toString().padStart(2, "0")}:00`,
                    value: i.toString(),
                  }))}
                  value={settEndHour}
                  onChange={(e) => setSettEndHour(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Sending Limits */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
            <h3 className="text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-4">Sending Limits</h3>
            <div className="grid grid-cols-2 gap-4">
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
          </div>

          {/* Email Accounts */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
            <h3 className="text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-2">Email Accounts</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
              Select accounts to rotate between when sending. If none selected, the default org account is used.
            </p>
            {emailAccounts.length > 0 ? (
              <div className="space-y-2">
                {emailAccounts.map((acc) => (
                  <label
                    key={acc.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors",
                      settAccountIds.includes(acc.id)
                        ? "border-neutral-950 dark:border-white bg-neutral-50 dark:bg-neutral-800"
                        : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-400"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={settAccountIds.includes(acc.id)}
                      onChange={() => toggleAccount(acc.id)}
                      className="rounded border-neutral-300 text-neutral-950 focus:ring-neutral-950"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">{acc.email_address}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 capitalize">{acc.provider}</p>
                    </div>
                    {acc.is_default && <Badge variant="neutral">Default</Badge>}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                No active email accounts found. Connect an account in Settings.
              </p>
            )}
          </div>

          {/* Stop Conditions */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
            <h3 className="text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-4">Stop Conditions</h3>
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
                    className="rounded border-neutral-300 text-neutral-950 focus:ring-neutral-950"
                  />
                  <span className="text-sm text-neutral-950 dark:text-neutral-50">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Timezone */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
            <h3 className="text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-4">Timezone</h3>
            <Select
              label="Sending Timezone"
              options={[
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
              ]}
              value={settTimezone}
              onChange={(e) => setSettTimezone(e.target.value)}
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={isPending}>
              {isPending ? "Saving..." : "Save Settings"}
            </Button>
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
            <h2 className="text-lg font-serif text-neutral-950 dark:text-neutral-50">
              {editingStep ? "Edit Step" : "Add Step"}
            </h2>
            <button
              onClick={() => setShowStepModal(false)}
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <XIcon size={20} className="text-neutral-500" />
            </button>
          </div>

          <div className="space-y-4">
            <Select label="Step Type" required options={stepTypeOptions} value={stepType} onChange={(e) => { setStepType(e.target.value); setStepChannel(getChannelForStepType(e.target.value)); }} />
            <Input label="Delay (days)" type="number" min="0" placeholder="0" value={stepDelayDays} onChange={(e) => setStepDelayDays(e.target.value)} />

            {/* Channel badge */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Channel:</span>
              <Badge variant={stepType === "whatsapp" ? "green" : stepType.startsWith("linkedin") ? "blue" : stepType === "email" ? "neutral" : "amber"}>
                {getChannelForStepType(stepType).charAt(0).toUpperCase() + getChannelForStepType(stepType).slice(1)}
              </Badge>
            </div>

            {/* ─── Email Step Fields ─── */}
            {stepType === "email" && (
              <>
                {showVariantB && (
                  <div className="flex items-center gap-2">
                    <Badge variant="blue">Variant A ({variantAWeight}%)</Badge>
                  </div>
                )}
                <Input label="Subject" placeholder="e.g. Quick question about {{company}}" value={stepSubject} onChange={(e) => setStepSubject(e.target.value)} />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 flex-wrap">
                    {mergeFields.map((mf) => (
                      <button key={mf.value} type="button" onClick={() => insertMergeField(mf.value, "subject")} className="px-2 py-0.5 text-[11px] rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">
                        {mf.label}
                      </button>
                    ))}
                  </div>
                  <span className={cn("text-xs tabular-nums", stepSubject.length > 60 ? "text-red-500" : stepSubject.length > 50 ? "text-amber-500" : "text-neutral-400")}>
                    {stepSubject.length}/60
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-neutral-950 dark:text-neutral-50">Body</label>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setTemplateTarget("a"); loadTemplates(); setShowTemplatePicker(true); }}>Use Template</Button>
                      <Button variant="outline" size="sm" leftIcon={<SparkleIcon size={16} />} onClick={() => setAIWriteOpen(true)}>AI Write</Button>
                    </div>
                  </div>
                  <Textarea placeholder="Write your email content..." value={stepBody} onChange={(e) => setStepBody(e.target.value)} />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 flex-wrap">
                      {mergeFields.map((mf) => (
                        <button key={mf.value} type="button" onClick={() => insertMergeField(mf.value, "body")} className="px-2 py-0.5 text-[11px] rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">
                          {mf.label}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => setShowPreview(!showPreview)} className="text-xs text-neutral-500 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors flex items-center gap-1">
                      <EyeIcon size={14} /> {showPreview ? "Hide Preview" : "Preview"}
                    </button>
                  </div>
                  {showPreview && (
                    <div className="rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-4 space-y-2">
                      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Preview with sample data:</p>
                      <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                        {stepSubject.replace(/\{\{first_name\}\}/gi, "John").replace(/\{\{name\}\}/gi, "John Smith").replace(/\{\{company\}\}/gi, "Acme Corp").replace(/\{\{email\}\}/gi, "john@acme.com")}
                      </p>
                      <div className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                        {stepBody.replace(/\{\{first_name\}\}/gi, "John").replace(/\{\{name\}\}/gi, "John Smith").replace(/\{\{company\}\}/gi, "Acme Corp").replace(/\{\{email\}\}/gi, "john@acme.com")}
                      </div>
                    </div>
                  )}
                </div>
                {/* A/B Variant B */}
                {!showVariantB ? (
                  <button type="button" onClick={() => setShowVariantB(true)} className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors">
                    <PlusIcon size={16} weight="bold" /> Add Variant B (A/B Test)
                  </button>
                ) : (
                  <div className="border border-dashed border-neutral-300 dark:border-neutral-700 rounded p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="violet">Variant B ({100 - variantAWeight}%)</Badge>
                      <button type="button" onClick={() => { setShowVariantB(false); setVariantBSubject(""); setVariantBBody(""); }} className="flex h-6 w-6 items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                        <XIcon size={14} className="text-neutral-500" />
                      </button>
                    </div>
                    <Input label="Subject B" placeholder="Alternative subject line..." value={variantBSubject} onChange={(e) => setVariantBSubject(e.target.value)} />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-neutral-950 dark:text-neutral-50">Body B</label>
                        <Button variant="outline" size="sm" onClick={() => { setTemplateTarget("b"); loadTemplates(); setShowTemplatePicker(true); }}>Use Template</Button>
                      </div>
                      <Textarea placeholder="Alternative email body..." value={variantBBody} onChange={(e) => setVariantBBody(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">Split: A {variantAWeight}% / B {100 - variantAWeight}%</label>
                      <input type="range" min={10} max={90} value={variantAWeight} onChange={(e) => setVariantAWeight(parseInt(e.target.value))} className="w-full accent-neutral-950 dark:accent-white" />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ─── WhatsApp Step Fields ─── */}
            {stepType === "whatsapp" && (
              <div className="space-y-4 border border-emerald-200 dark:border-emerald-900/50 rounded p-4 bg-emerald-50/50 dark:bg-emerald-900/10">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">WhatsApp Message</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
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
                    <button key={mf.value} type="button" onClick={() => insertMergeField(mf.value, "body")} className="px-2 py-0.5 text-[11px] rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors">
                      {mf.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ─── LinkedIn Connect Step ─── */}
            {stepType === "linkedin_connect" && (
              <div className="space-y-4 border border-blue-200 dark:border-blue-900/50 rounded p-4 bg-blue-50/50 dark:bg-blue-900/10">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wider">Connection Request</p>
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
                        <button key={mf.value} type="button" onClick={() => setChannelConfig({ ...channelConfig, connection_note: ((channelConfig.connection_note as string) || "") + ` ${mf.value}` })} className="px-2 py-0.5 text-[11px] rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors">
                          {mf.label}
                        </button>
                      ))}
                    </div>
                    <span className={cn("text-xs tabular-nums", ((channelConfig.connection_note as string) || "").length > 280 ? "text-red-500" : "text-neutral-400")}>
                      {((channelConfig.connection_note as string) || "").length}/300
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ─── LinkedIn Message Step ─── */}
            {stepType === "linkedin_message" && (
              <div className="space-y-4 border border-blue-200 dark:border-blue-900/50 rounded p-4 bg-blue-50/50 dark:bg-blue-900/10">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wider">LinkedIn Message</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Lead must be a 1st-degree connection. If not connected, a connection request will be sent first.
                </p>
                <Input label="Subject" placeholder="Quick question about {{company}}" value={stepSubject} onChange={(e) => setStepSubject(e.target.value)} />
                <Textarea placeholder="Write your LinkedIn message..." value={stepBody} onChange={(e) => setStepBody(e.target.value)} />
                <div className="flex items-center gap-1 flex-wrap">
                  {mergeFields.map((mf) => (
                    <button key={mf.value} type="button" onClick={() => insertMergeField(mf.value, "body")} className="px-2 py-0.5 text-[11px] rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors">
                      {mf.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ─── LinkedIn Profile View ─── */}
            {stepType === "linkedin_view" && (
              <div className="space-y-3 border border-blue-200 dark:border-blue-900/50 rounded p-4 bg-blue-50/50 dark:bg-blue-900/10">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wider">Profile View</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Views the lead&apos;s LinkedIn profile to warm them up before a connection request. The lead will see your profile in their &quot;Who viewed your profile&quot; section.
                </p>
                <Textarea placeholder="Optional notes for this step..." value={stepBody} onChange={(e) => setStepBody(e.target.value)} />
              </div>
            )}

            {/* ─── LinkedIn Endorse ─── */}
            {stepType === "linkedin_endorse" && (
              <div className="space-y-4 border border-blue-200 dark:border-blue-900/50 rounded p-4 bg-blue-50/50 dark:bg-blue-900/10">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wider">Skill Endorsement</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
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
                <label className="block text-sm font-medium text-neutral-950 dark:text-neutral-50">
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
            <h2 className="text-lg font-serif text-neutral-950 dark:text-neutral-50">Select Template</h2>
            <button
              onClick={() => setShowTemplatePicker(false)}
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <XIcon size={20} className="text-neutral-500" />
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
                  className="w-full text-left p-3 rounded border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">{tpl.name}</p>
                    <Badge variant="neutral">{tpl.category}</Badge>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1">{tpl.subject}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-8">
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
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              {enrollSelectedIds.size} selected
            </span>
            <Button
              onClick={handleBulkEnroll}
              disabled={isPending || enrollSelectedIds.size === 0}
            >
              {isPending ? "Enrolling..." : `Enroll ${enrollSelectedIds.size} Lead${enrollSelectedIds.size !== 1 ? "s" : ""}`}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search leads by name, email, or company..."
              value={enrollSearchQuery}
              onChange={(e) => handleEnrollSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-950 dark:text-neutral-50 placeholder:text-neutral-400"
            />
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
              className="text-xs font-medium text-neutral-500 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors"
            >
              {enrollSelectedIds.size === enrollLeadsList.length ? "Deselect All" : `Select All (${enrollLeadsList.length})`}
            </button>
          )}

          {/* Lead List */}
          {enrollLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
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
                      ? "border-neutral-950 dark:border-white bg-neutral-50 dark:bg-neutral-800"
                      : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-400",
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
                    className="rounded border-neutral-300 text-neutral-950 focus:ring-neutral-950"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">{lead.name}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{lead.email}</p>
                  </div>
                  {lead.score != null && (
                    <Badge variant={lead.score >= 70 ? "green" : lead.score >= 40 ? "amber" : "neutral"}>
                      {lead.score}
                    </Badge>
                  )}
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-8">
              {enrollSearchQuery ? "No matching leads found." : "No leads available to enroll."}
            </p>
          )}
        </div>
      </Drawer>
    </div>
  );
}
