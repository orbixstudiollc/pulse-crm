"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Badge,
  Textarea,
  ActionMenu,
  TrashIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  PencilSimpleIcon,
  CheckIcon,
  CaretDownIcon,
  Avatar,
} from "@/components/ui";
import { ActivityRow, type ActivityRowType, ConfirmModal } from "@/components/dashboard";
import { cn } from "@/lib/utils";
import {
  ScheduleMeetingModal,
  CreateTaskModal,
  ActivityDetailDrawer,
  MarkDealWonModal,
  MarkDealLostModal,
  AddDealModal,
  type DealFormData,
} from "@/components/features";
import { usePageHeader } from "@/hooks";
import { addDealNote, deleteDeal, updateDeal, updateDealStage } from "@/lib/actions/deals";
import { toast } from "sonner";

// --- Types ---

type DealStage = "discovery" | "qualification" | "proposal" | "negotiation" | "closed_won" | "closed_lost";

interface DealRow {
  id: string;
  name: string;
  company: string | null;
  contact_name?: string | null;
  value: number | null;
  stage: string;
  probability: number | null;
  expected_close_date?: string | null;
  close_date?: string | null;
  days_in_stage?: number | null;
  days_to_close?: number | null;
  owner_name?: string | null;
  owner_id?: string | null;
  notes?: string | null;
  customer_id: string | null;
  created_at: string;
  [key: string]: unknown;
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

interface DealDetailClientProps {
  deal: DealRow;
  notes: NoteRow[] | undefined;
  activities: ActivityRow2[] | undefined;
}

// --- Stage config ---

const pipelineStages: { id: DealStage; label: string }[] = [
  { id: "discovery", label: "Discovery" },
  { id: "qualification", label: "Qualification" },
  { id: "proposal", label: "Proposal" },
  { id: "negotiation", label: "Negotiation" },
  { id: "closed_won", label: "Closed Won" },
  { id: "closed_lost", label: "Closed Lost" },
];

const activeStageOrder: DealStage[] = [
  "discovery",
  "qualification",
  "proposal",
  "negotiation",
  "closed_won",
];

const stageLabels: Record<string, string> = {
  discovery: "Discovery",
  qualification: "Qualification",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

const stageColorMap: Record<string, string> = {
  discovery: "bg-blue-500",
  qualification: "bg-amber-500",
  proposal: "bg-amber-500",
  negotiation: "bg-amber-500",
  closed_won: "bg-green-500",
  closed_lost: "bg-red-500",
};

// --- Helper components ---

function StageProgress({ currentStage }: { currentStage: string }) {
  const currentIndex = activeStageOrder.indexOf(
    currentStage === "closed_lost" ? "closed_won" : (currentStage as DealStage),
  );
  const isLost = currentStage === "closed_lost";

  return (
    <div className="flex gap-1">
      {activeStageOrder.map((stage, index) => {
        const isFilled = index <= currentIndex && !isLost;
        const isLostFilled = isLost && index <= currentIndex;

        return (
          <div
            key={stage}
            className={cn(
              "h-2 flex-1 rounded-sm transition-colors",
              isFilled
                ? "bg-neutral-950 dark:bg-neutral-50"
                : isLostFilled
                  ? "bg-red-500"
                  : "bg-neutral-200 dark:bg-neutral-700",
            )}
          />
        );
      })}
    </div>
  );
}

function StageDropdown({
  currentStage,
  onChange,
}: {
  currentStage: string;
  onChange: (stage: DealStage) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-3 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-sm font-medium text-neutral-950 dark:text-neutral-50 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
      >
        {stageLabels[currentStage] || currentStage}
        <CaretDownIcon
          size={16}
          className={cn(
            "text-neutral-500 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-lg z-20 py-1">
            {pipelineStages.map((stage) => (
              <button
                key={stage.id}
                onClick={() => {
                  onChange(stage.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center w-full px-4 py-2 text-sm text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                  currentStage === stage.id
                    ? "text-neutral-950 dark:text-neutral-50 font-medium"
                    : "text-neutral-600 dark:text-neutral-400",
                )}
              >
                {stage.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// --- Main component ---

export function DealDetailClient({
  deal,
  notes,
  activities,
}: DealDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const dealNotes = notes || [];
  const activityItems = activities || [];

  const [newNote, setNewNote] = useState("");
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showWonModal, setShowWonModal] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityRow2 | null>(null);
  const [showActivityDrawer, setShowActivityDrawer] = useState(false);
  const [currentStage, setCurrentStage] = useState(deal.stage);

  const contactName = deal.contact_name || "Unknown Contact";

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
      const res = await addDealNote(deal.id, newNote.trim());
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
      const res = await deleteDeal(deal.id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Deal deleted");
        router.push("/dashboard/sales");
      }
    });
  };

  const handleStageChange = (newStage: DealStage) => {
    setCurrentStage(newStage);
    startTransition(async () => {
      const res = await updateDealStage(deal.id, newStage);
      if (res.error) {
        toast.error(res.error);
        setCurrentStage(deal.stage);
      } else {
        toast.success(`Stage updated to ${stageLabels[newStage]}`);
        router.refresh();
      }
    });
  };

  const handleMarkWon = () => {
    handleStageChange("closed_won");
    setShowWonModal(false);
  };

  const handleMarkLost = () => {
    handleStageChange("closed_lost");
    setShowLostModal(false);
  };

  const handleEditSubmit = (data: DealFormData) => {
    startTransition(async () => {
      const res = await updateDeal(deal.id, {
        name: data.name,
        contact_name: data.customer,
        value: parseFloat(data.value) || 0,
        stage: data.stage,
        probability: parseInt(data.probability) || 0,
        expected_close_date: data.expectedClose || null,
        notes: data.notes || null,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Deal updated");
        setShowEditModal(false);
        router.refresh();
      }
    });
  };

  const headerActions = useMemo(
    () => (
      <>
        <Button
          variant="outline"
          leftIcon={<PencilSimpleIcon size={16} />}
          onClick={() => setShowEditModal(true)}
        >
          Edit Deal
        </Button>
        <ActionMenu
          items={[
            {
              label: "Delete Deal",
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
    backHref: "/dashboard/sales",
    actions: headerActions,
    breadcrumbLabel: deal.name,
  });

  return (
    <div className="min-h-full bg-neutral-100 dark:bg-neutral-900 p-4 sm:p-6 lg:p-8">
      {/* Header Card */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 mb-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <Badge variant="amber" className="mb-3">
              {stageLabels[currentStage] || currentStage}
            </Badge>
            <h1 className="text-2xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              {deal.name} - {formatCurrency(deal.value || 0)}
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {deal.company || contactName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-300 dark:hover:border-red-500/40"
              onClick={() => setShowLostModal(true)}
            >
              Mark Lost
            </Button>
            <Button
              leftIcon={<CheckIcon size={18} />}
              onClick={() => setShowWonModal(true)}
            >
              Mark Won
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 text-center">
            <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              {deal.days_in_stage || 0}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Days in Stage
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 text-center">
            <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              {deal.days_to_close || 0}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Days to Close
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 text-center">
            <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              {deal.probability || 0}%
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Probability
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 text-center">
            <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              {activityItems.length}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Activities
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid */}
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
              {dealNotes.length > 0 ? (
                <div className="space-y-6 mb-6">
                  {dealNotes.map((note) => (
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
          {/* Deal Stage */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-4">
              Deal Stage
            </p>
            <div className="flex items-center gap-2 mb-4">
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  stageColorMap[currentStage] || "bg-neutral-400",
                )}
              />
              <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                {stageLabels[currentStage] || currentStage}
              </span>
            </div>
            <div className="mb-4">
              <StageProgress currentStage={currentStage} />
            </div>
            <StageDropdown
              currentStage={currentStage}
              onChange={handleStageChange}
            />
          </div>

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

          {/* Contact */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-4">
              Contact
            </p>
            <div className="flex items-center gap-3">
              <Avatar name={contactName} size="md" />
              <div>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {contactName}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {deal.company || "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-4">
              Details
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">Expected Close</p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {formatDate(deal.expected_close_date ?? deal.close_date ?? null)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">Created</p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {formatDate(deal.created_at)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">Owner</p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {deal.owner_name || "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ScheduleMeetingModal
        open={showMeetingModal}
        onClose={() => setShowMeetingModal(false)}
        customerName={contactName}
      />

      <CreateTaskModal
        open={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        customerName={contactName}
      />

      <ActivityDetailDrawer
        open={showActivityDrawer}
        onClose={() => setShowActivityDrawer(false)}
        activity={selectedActivity ? { ...selectedActivity, description: selectedActivity.description ?? "", type: selectedActivity.type as "call" | "meeting" | "task" | "email" | "note" | "deal" | "invoice" } : null}
        customerName={contactName}
        onReschedule={() => {
          setShowActivityDrawer(false);
          setShowMeetingModal(true);
        }}
      />

      <MarkDealWonModal
        open={showWonModal}
        onClose={() => setShowWonModal(false)}
        dealValue={deal.value || 0}
        onConfirm={handleMarkWon}
      />

      <MarkDealLostModal
        open={showLostModal}
        onClose={() => setShowLostModal(false)}
        onConfirm={handleMarkLost}
      />

      <AddDealModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        mode="edit"
        initialData={{
          name: deal.name,
          customer: contactName,
          value: (deal.value || 0).toString(),
          stage: deal.stage as "discovery" | "proposal" | "negotiation" | "closed_won" | "closed_lost",
          probability: (deal.probability || 0).toString(),
          expectedClose: deal.expected_close_date || "",
          notes: deal.notes || "",
        }}
        onSubmit={handleEditSubmit}
      />
      <ConfirmModal
        open={showDeleteConfirm}
        title="Delete Deal"
        message="Are you sure you want to delete this deal? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={executeDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
