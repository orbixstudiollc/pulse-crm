"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
} from "@/components/ui";
import { PageHeader, StatCard, TableHeader, TableFooter, EmptyState } from "@/components/dashboard";
import { AIGenerateModal } from "@/components/features";
import { SparkleIcon } from "@/components/ui/Icons";
import {
  updateSequence,
  addSequenceStep,
  updateSequenceStep,
  deleteSequenceStep,
  enrollLead,
  updateEnrollmentStatus,
} from "@/lib/actions/sequences";
import { aiGenerateEmail } from "@/lib/actions/ai-outreach";
import { cn } from "@/lib/utils";

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
};

const stepTypeOptions = [
  { label: "Email", value: "email" },
  { label: "Wait", value: "wait" },
  { label: "Task", value: "task" },
  { label: "Call", value: "call" },
  { label: "LinkedIn", value: "linkedin" },
];

const channelOptions = [
  { label: "Email", value: "email" },
  { label: "Phone", value: "phone" },
  { label: "LinkedIn", value: "linkedin" },
  { label: "SMS", value: "sms" },
];

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

// ── Component ────────────────────────────────────────────────────────────────

export function SequenceDetailClient({
  sequence,
  steps,
  enrollments,
  analytics,
}: {
  sequence: SequenceRecord;
  steps: StepRecord[];
  enrollments: EnrollmentRecord[];
  analytics: AnalyticsData | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"steps" | "enrolled" | "analytics">("steps");

  // Step modal state
  const [showStepModal, setShowStepModal] = useState(false);
  const [editingStep, setEditingStep] = useState<StepRecord | null>(null);
  const [stepType, setStepType] = useState("email");
  const [stepDelayDays, setStepDelayDays] = useState("0");
  const [stepSubject, setStepSubject] = useState("");
  const [stepBody, setStepBody] = useState("");
  const [stepChannel, setStepChannel] = useState("email");

  // AI Write state
  const [aiWriteOpen, setAIWriteOpen] = useState(false);
  const [aiWriteStepIndex, setAIWriteStepIndex] = useState<number | null>(null);

  // Enrollment pagination
  const [enrollPage, setEnrollPage] = useState(1);
  const [enrollRowsPerPage, setEnrollRowsPerPage] = useState("10");

  const status = statusConfig[sequence.status] || statusConfig.draft;
  const categoryLabel = categoryConfig[sequence.category] || sequence.category;

  // Analytics values
  const totalSteps = analytics?.totalSteps ?? steps.length;
  const totalEnrolled = analytics?.totalEnrolled ?? enrollments.length;
  const activeEnrolled = analytics?.statusCounts?.active ?? 0;
  const replied = analytics?.statusCounts?.replied ?? 0;
  const replyRate = analytics?.replyRate ?? 0;

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
    setShowStepModal(true);
  };

  // Open edit step modal
  const openEditStep = (step: StepRecord) => {
    setEditingStep(step);
    setStepType(step.step_type || "email");
    setStepDelayDays(String(step.delay_days || 0));
    setStepSubject(step.subject || "");
    setStepBody(step.body || "");
    setStepChannel(step.channel || "email");
    setShowStepModal(true);
  };

  // Save step
  const handleSaveStep = () => {
    startTransition(async () => {
      if (editingStep) {
        const result = await updateSequenceStep(editingStep.id, {
          step_type: stepType,
          delay_days: parseInt(stepDelayDays) || 0,
          subject: stepSubject || null,
          body: stepBody || null,
          channel: stepChannel || null,
        });
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Step updated");
          setShowStepModal(false);
          router.refresh();
        }
      } else {
        const result = await addSequenceStep({
          sequence_id: sequence.id,
          step_order: steps.length + 1,
          step_type: stepType,
          delay_days: parseInt(stepDelayDays) || 0,
          subject: stepSubject || undefined,
          body: stepBody || undefined,
          channel: stepChannel || undefined,
        });
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Step added");
          setShowStepModal(false);
          router.refresh();
        }
      }
    });
  };

  // Delete step
  const handleDeleteStep = (stepId: string) => {
    startTransition(async () => {
      const result = await deleteSequenceStep(stepId, sequence.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Step deleted");
        router.refresh();
      }
    });
  };

  // Toggle enrollment status
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
      const result = await updateEnrollmentStatus(
        enrollmentId,
        statusMap[action]
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          action === "pause"
            ? "Enrollment paused"
            : action === "resume"
              ? "Enrollment resumed"
              : "Lead removed from sequence"
        );
        router.refresh();
      }
    });
  };

  // Toggle sequence status
  const handleToggleStatus = () => {
    const newStatus = sequence.status === "active" ? "paused" : "active";
    startTransition(async () => {
      const result = await updateSequence(sequence.id, {
        status: newStatus as "active" | "paused",
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          `Sequence ${newStatus === "active" ? "activated" : "paused"}`
        );
        router.refresh();
      }
    });
  };

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
            <Badge variant={status.variant} dot>
              {status.label}
            </Badge>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              {categoryLabel}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              leftIcon={<PlusIcon size={18} weight="bold" />}
              onClick={openAddStep}
            >
              Add Step
            </Button>
            <Button variant="outline" onClick={handleToggleStatus} disabled={isPending}>
              {sequence.status === "active" ? "Pause" : "Activate"}
            </Button>
          </div>
        </div>

        {sequence.description && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
            {sequence.description}
          </p>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Steps"
          value={totalSteps.toString()}
          icon={
            <EnvelopeIcon
              size={24}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
        <StatCard
          label="Enrolled"
          value={totalEnrolled.toString()}
          icon={
            <CheckCircleIcon
              size={24}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
        <StatCard
          label="Replied"
          value={replied.toString()}
          icon={
            <EnvelopeIcon
              size={24}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
        <StatCard
          label="Reply Rate"
          value={`${replyRate}%`}
          icon={
            <ClockIcon
              size={24}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-1.5 w-fit">
        <button
          onClick={() => setActiveTab("steps")}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
            activeTab === "steps"
              ? "bg-neutral-950 dark:bg-white text-white dark:text-neutral-950"
              : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          )}
        >
          Steps
        </button>
        <button
          onClick={() => setActiveTab("enrolled")}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
            activeTab === "enrolled"
              ? "bg-neutral-950 dark:bg-white text-white dark:text-neutral-950"
              : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          )}
        >
          Enrolled Leads
          {enrollments.length > 0 && (
            <span className="ml-1.5 text-xs opacity-60">
              ({enrollments.length})
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
            activeTab === "analytics"
              ? "bg-neutral-950 dark:bg-white text-white dark:text-neutral-950"
              : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          )}
        >
          Analytics
        </button>
      </div>

      {/* Steps Tab */}
      {activeTab === "steps" && (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
          {steps.length > 0 ? (
            <div className="space-y-0">
              {steps.map((step, index) => {
                const typeConfig =
                  stepTypeConfig[step.step_type] || stepTypeConfig.email;
                const isLast = index === steps.length - 1;

                return (
                  <div key={step.id} className="relative flex gap-4">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center">
                      <StepIcon type={step.step_type} />
                      {!isLast && (
                        <div className="w-px flex-1 bg-neutral-200 dark:bg-neutral-800 my-1" />
                      )}
                    </div>

                    {/* Step content */}
                    <div
                      className={cn(
                        "flex-1 pb-6",
                        isLast && "pb-0"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">
                              Step {step.step_order}
                            </span>
                            <Badge
                              variant={
                                step.step_type === "email"
                                  ? "blue"
                                  : step.step_type === "wait"
                                    ? "neutral"
                                    : step.step_type === "task"
                                      ? "amber"
                                      : step.step_type === "call"
                                        ? "green"
                                        : "violet"
                              }
                            >
                              {typeConfig.label}
                            </Badge>
                            {step.delay_days > 0 && (
                              <Badge variant="neutral">
                                Wait {step.delay_days} day
                                {step.delay_days !== 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>

                          {step.subject && (
                            <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                              {step.subject}
                            </p>
                          )}
                          {step.body && (
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2">
                              {step.body}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openEditStep(step)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                          >
                            <PencilSimpleIcon
                              size={16}
                              className="text-neutral-500"
                            />
                          </button>
                          <button
                            onClick={() => handleDeleteStep(step.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          >
                            <TrashIcon
                              size={16}
                              className="text-neutral-500 hover:text-red-500"
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
                No steps added yet. Add your first step to build this
                sequence.
              </p>
            </div>
          )}

          {/* Add Step Button */}
          <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <Button
              variant="outline"
              leftIcon={<PlusIcon size={18} weight="bold" />}
              onClick={openAddStep}
            >
              Add Step
            </Button>
          </div>
        </div>
      )}

      {/* Enrolled Leads Tab */}
      {activeTab === "enrolled" && (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
          <TableHeader
            title="Enrolled Leads"
            rowsPerPage={enrollRowsPerPage}
            onRowsPerPageChange={(value) => {
              setEnrollRowsPerPage(value);
              setEnrollPage(1);
            }}
          />

          {enrollments.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-[0.5px] border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
                      <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3">
                        Lead
                      </th>
                      <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        Current Step
                      </th>
                      <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        Status
                      </th>
                      <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        Enrolled
                      </th>
                      <th className="text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 px-3 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedEnrollments.map((enrollment) => {
                      const lead = enrollment.leads;
                      const enrollStatus =
                        enrollmentStatusConfig[enrollment.status] ||
                        enrollmentStatusConfig.active;

                      return (
                        <tr
                          key={enrollment.id}
                          className="border-b-[0.5px] border-neutral-200 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar name={lead?.name || "Unknown"} />
                              <div>
                                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                                  {lead?.name || "Unknown"}
                                </p>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                  {lead?.email || "—"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                            <span className="text-sm font-medium font-serif text-neutral-950 dark:text-neutral-50">
                              {enrollment.current_step} / {totalSteps}
                            </span>
                          </td>
                          <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                            <Badge variant={enrollStatus.variant} dot>
                              {enrollStatus.label}
                            </Badge>
                          </td>
                          <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                            <span className="text-sm text-neutral-500 dark:text-neutral-400">
                              {new Date(
                                enrollment.enrolled_at
                              ).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="px-3 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                            <div className="flex justify-center">
                              <ActionMenu
                                items={[
                                  ...(enrollment.status === "active"
                                    ? [
                                        {
                                          label: "Pause",
                                          icon: <ClockIcon size={18} />,
                                          onClick: () =>
                                            handleEnrollmentAction(
                                              enrollment.id,
                                              "pause"
                                            ),
                                        },
                                      ]
                                    : []),
                                  ...(enrollment.status === "paused"
                                    ? [
                                        {
                                          label: "Resume",
                                          icon: (
                                            <CheckCircleIcon size={18} />
                                          ),
                                          onClick: () =>
                                            handleEnrollmentAction(
                                              enrollment.id,
                                              "resume"
                                            ),
                                        },
                                      ]
                                    : []),
                                  {
                                    label: "Remove",
                                    icon: <TrashIcon size={18} />,
                                    onClick: () =>
                                      handleEnrollmentAction(
                                        enrollment.id,
                                        "remove"
                                      ),
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
              <div className="w-12 h-12 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center mb-5">
                <CheckCircleIcon
                  size={24}
                  className="text-neutral-950 dark:text-neutral-50"
                />
              </div>
              <h3 className="text-2xl font-serif text-neutral-950 dark:text-neutral-50 mb-2">
                No leads enrolled
              </h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-xs">
                Enroll leads from the Leads page to start this outreach
                sequence.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === "analytics" && (
        <div className="space-y-4">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Total Enrolled"
              value={totalEnrolled.toString()}
              icon={
                <CheckCircleIcon
                  size={24}
                  className="text-neutral-950 dark:text-neutral-50"
                />
              }
            />
            <StatCard
              label="Active"
              value={activeEnrolled.toString()}
              icon={
                <ClockIcon
                  size={24}
                  className="text-neutral-950 dark:text-neutral-50"
                />
              }
            />
            <StatCard
              label="Replied"
              value={replied.toString()}
              icon={
                <EnvelopeIcon
                  size={24}
                  className="text-neutral-950 dark:text-neutral-50"
                />
              }
            />
            <StatCard
              label="Reply Rate"
              value={`${replyRate}%`}
              icon={
                <CheckCircleIcon
                  size={24}
                  className="text-neutral-950 dark:text-neutral-50"
                />
              }
            />
          </div>

          {/* Status Breakdown */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
            <h3 className="text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-4">
              Enrollment Status Breakdown
            </h3>
            {analytics?.statusCounts && Object.keys(analytics.statusCounts).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(analytics.statusCounts).map(([statusKey, count]) => {
                  const config = enrollmentStatusConfig[statusKey] || {
                    label: statusKey,
                    variant: "neutral" as const,
                  };
                  const percentage =
                    totalEnrolled > 0
                      ? Math.round((count / totalEnrolled) * 100)
                      : 0;

                  return (
                    <div key={statusKey} className="flex items-center gap-4">
                      <div className="w-28 shrink-0">
                        <Badge variant={config.variant} dot>
                          {config.label}
                        </Badge>
                      </div>
                      <div className="flex-1 h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            statusKey === "active"
                              ? "bg-green-500"
                              : statusKey === "paused"
                                ? "bg-amber-500"
                                : statusKey === "completed"
                                  ? "bg-blue-500"
                                  : statusKey === "replied"
                                    ? "bg-green-400"
                                    : statusKey === "bounced"
                                      ? "bg-red-500"
                                      : "bg-neutral-400"
                          )}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium font-serif text-neutral-950 dark:text-neutral-50 w-12 text-right">
                        {count}
                      </span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 w-10 text-right">
                        {percentage}%
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                No enrollment data available yet.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Step Modal */}
      <Modal
        open={showStepModal}
        onClose={() => setShowStepModal(false)}
      >
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-serif text-neutral-950 dark:text-neutral-50">
              {editingStep ? "Edit Step" : "Add Step"}
            </h2>
            <button
              onClick={() => setShowStepModal(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <XIcon size={20} className="text-neutral-500" />
            </button>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <Select
              label="Step Type"
              required
              options={stepTypeOptions}
              value={stepType}
              onChange={(e) => setStepType(e.target.value)}
            />
            <Input
              label="Delay (days)"
              type="number"
              min="0"
              placeholder="0"
              value={stepDelayDays}
              onChange={(e) => setStepDelayDays(e.target.value)}
            />
            {(stepType === "email" || stepType === "linkedin") && (
              <Input
                label="Subject"
                placeholder="e.g. Quick question about {{company}}"
                value={stepSubject}
                onChange={(e) => setStepSubject(e.target.value)}
              />
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {stepType === "wait"
                    ? "Notes"
                    : stepType === "task"
                      ? "Task Description"
                      : "Body"}
                </label>
                {(stepType === "email" || stepType === "linkedin") && (
                  <Button
                    variant="outline"
                    leftIcon={<SparkleIcon size={16} />}
                    onClick={() => {
                      setAIWriteOpen(true);
                    }}
                  >
                    AI Write
                  </Button>
                )}
              </div>
              <Textarea
                placeholder={
                  stepType === "email"
                    ? "Write your email content..."
                    : stepType === "call"
                      ? "Call script or talking points..."
                      : stepType === "task"
                        ? "Describe the task..."
                        : stepType === "linkedin"
                          ? "Write your LinkedIn message..."
                          : "Add notes for this wait step..."
                }
                value={stepBody}
                onChange={(e) => setStepBody(e.target.value)}
              />
            </div>
            <Select
              label="Channel"
              options={channelOptions}
              value={stepChannel}
              onChange={(e) => setStepChannel(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowStepModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSaveStep}
              disabled={isPending}
            >
              {isPending
                ? "Saving..."
                : editingStep
                  ? "Update Step"
                  : "Add Step"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* AI Write Email Modal */}
      <AIGenerateModal
        isOpen={aiWriteOpen}
        onClose={() => {
          setAIWriteOpen(false);
          setAIWriteStepIndex(null);
        }}
        title="AI Write Email"
        description="Generate an AI-powered email for this sequence step"
        onGenerate={async () => {
          // Use the first enrolled lead for context, if available
          const firstEnrolledLead = enrollments.find((e) => e.leads)?.leads;
          if (!firstEnrolledLead) {
            throw new Error(
              "No enrolled leads found. Enroll a lead first to generate personalized emails."
            );
          }
          const result = await aiGenerateEmail(firstEnrolledLead.id);
          if ("error" in result) throw new Error(result.error);
          return `Subject: ${result.subject}\n\n${result.body}`;
        }}
        onApply={(content) => {
          // Parse the generated content to extract subject and body
          const lines = content.split("\n");
          const subjectLine = lines[0] || "";
          const subject = subjectLine.startsWith("Subject: ")
            ? subjectLine.slice(9)
            : subjectLine;
          const body = lines.slice(2).join("\n").trim();
          setStepSubject(subject);
          setStepBody(body);
          setAIWriteOpen(false);
          setAIWriteStepIndex(null);
        }}
        applyLabel="Use Email"
        editable={true}
      />
    </div>
  );
}
