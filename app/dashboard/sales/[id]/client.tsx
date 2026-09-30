"use client";

import { useState, useMemo, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Badge,
  Textarea,
  ActionMenu,
  DeleteConfirmModal,
  TrashIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  PencilSimpleIcon,
  CheckIcon,
  CaretDownIcon,
  CurrencyDollarIcon,
  Avatar,
} from "@/components/ui";
import {
  ActivityRow,
  type ActivityRowType,
  ConfirmModal,
  Page,
  PageHeader,
  MetricStrip,
  Metric,
  DetailLayout,
  Section,
  PanelSection,
  KeyValueList,
  KeyValue,
} from "@/components/dashboard";
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
import { deleteActivity } from "@/lib/actions/activities";
import { deleteCalendarEvent } from "@/lib/actions/calendar";
import { deleteRecordActivity, type LinkedItem } from "@/lib/actions/record-activities";
import { daysToClose, parseDealDate, stageDays } from "@/lib/deals/metrics";
import { toast } from "sonner";

// --- Types ---

type DealStage = "discovery" | "proposal" | "negotiation" | "closed_won" | "closed_lost";

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
  stage_changed_at?: string | null;
  owner_name?: string | null;
  owner_avatar?: string | null;
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
  linkedItems?: LinkedItem[];
}

// Per-record activities ("record") merged with linked org activities / calendar events.
type FeedItem = ActivityRow2 & { source: "record" | LinkedItem["source"] };

// --- Stage config ---

const pipelineStages: { id: DealStage; label: string }[] = [
  { id: "discovery", label: "Discovery" },
  { id: "proposal", label: "Proposal" },
  { id: "negotiation", label: "Negotiation" },
  { id: "closed_won", label: "Closed Won" },
  { id: "closed_lost", label: "Closed Lost" },
];

const activeStageOrder: DealStage[] = [
  "discovery",
  "proposal",
  "negotiation",
  "closed_won",
];

const stageLabels: Record<string, string> = {
  discovery: "Discovery",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

const stageColorMap: Record<string, string> = {
  discovery: "bg-accent-strong",
  proposal: "bg-warning",
  negotiation: "bg-warning",
  closed_won: "bg-success",
  closed_lost: "bg-danger",
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
                ? "bg-inverse"
                : isLostFilled
                  ? "bg-danger"
                  : "bg-active",
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
        className="flex items-center justify-between w-full px-4 py-3 rounded-md border border-line bg-surface text-sm font-medium text-fg hover:border-fg-muted transition-colors"
      >
        {stageLabels[currentStage] || currentStage}
        <CaretDownIcon
          size={16}
          className={cn(
            "text-fg-secondary transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-line bg-surface shadow-dropdown z-20 py-1" data-clay-box>
            {pipelineStages.map((stage) => (
              <button
                key={stage.id}
                onClick={() => {
                  onChange(stage.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center w-full px-4 py-2 text-sm text-left hover:bg-muted transition-colors",
                  currentStage === stage.id
                    ? "text-fg font-medium"
                    : "text-fg-secondary",
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

const subscribeNoop = () => () => {};

// --- Main component ---

export function DealDetailClient({
  deal,
  notes,
  activities,
  linkedItems,
}: DealDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<FeedItem | null>(null);

  const dealNotes = notes || [];
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
  const [showWonModal, setShowWonModal] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityRow2 | null>(null);
  const [showActivityDrawer, setShowActivityDrawer] = useState(false);
  const [currentStage, setCurrentStage] = useState(deal.stage);

  const contactName = deal.contact_name || "Unknown Contact";
  const expectedClose = deal.expected_close_date ?? deal.close_date ?? null;
  const isClosed = currentStage === "closed_won" || currentStage === "closed_lost";

  // Day counts depend on today's local date, so they are only known after
  // hydration (the server renders in UTC).
  const isMounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  const now = isMounted ? new Date() : null;
  const daysInStageLabel = now ? stageDays(deal.stage_changed_at, deal.created_at, now) : "—";
  const closeDays = now ? daysToClose(expectedClose, now) : null;
  const closeDaysLabel = isClosed
    ? "Closed"
    : closeDays === null
      ? "—"
      : closeDays < 0
        ? `Overdue by ${-closeDays} ${closeDays === -1 ? "day" : "days"}`
        : closeDays;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return parseDealDate(dateStr).toLocaleDateString("en-US", {
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
          ? await deleteRecordActivity("deal", item.id)
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
    <Page>
      {/* Record header */}
      <PageHeader
        icon={<CurrencyDollarIcon size={18} />}
        title={`${deal.name} - ${formatCurrency(deal.value || 0)}`}
        description={
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="warning">
              {stageLabels[currentStage] || currentStage}
            </Badge>
            <span>{deal.company || contactName}</span>
          </div>
        }
      >
        <Button
          variant="outline"
          className="border-danger text-danger hover:bg-danger-surface hover:border-danger"
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
      </PageHeader>

      {/* Stage stepper */}
      <div className="px-8 pb-6 max-sm:px-4">
        <StageProgress currentStage={currentStage} />
      </div>

      <MetricStrip>
        <Metric label="Days in Stage" value={daysInStageLabel} />
        <Metric label="Days to Close" value={closeDaysLabel} />
        <Metric label="Probability" value={`${deal.probability || 0}%`} />
        <Metric label="Activities" value={activityItems.length} />
      </MetricStrip>

      <DetailLayout
        className="border-t border-divider"
        aside={
          <>
            <PanelSection title="Deal Stage">
              <div className="flex items-center gap-2 mb-4">
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    stageColorMap[currentStage] || "bg-fg-muted",
                  )}
                />
                <span className="text-sm font-medium text-fg">
                  {stageLabels[currentStage] || currentStage}
                </span>
              </div>
              <StageDropdown
                currentStage={currentStage}
                onChange={handleStageChange}
              />
            </PanelSection>

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

            <PanelSection title="Contact">
              <div className="flex items-center gap-3">
                <Avatar name={contactName} size="md" />
                <div>
                  <p className="text-sm font-medium text-fg">
                    {contactName}
                  </p>
                  <p className="text-xs text-fg-secondary">
                    {deal.company || "—"}
                  </p>
                </div>
              </div>
            </PanelSection>

            <PanelSection title="Details">
              <KeyValueList>
                <KeyValue label="Expected Close">
                  {formatDate(expectedClose)}
                </KeyValue>
                <KeyValue label="Created">{formatDate(deal.created_at)}</KeyValue>
                <KeyValue label="Owner">
                  <span className="flex items-center gap-2">
                    {/* Same owner avatar the kanban card derives */}
                    <Avatar
                      src={deal.owner_avatar || "/images/avatars/user.jpg"}
                      name={deal.owner_name || "Deal owner"}
                      size="xs"
                    />
                    {deal.owner_name && <span>{deal.owner_name}</span>}
                  </span>
                </KeyValue>
              </KeyValueList>
            </PanelSection>
          </>
        }
      >
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

        <Section title="Notes">
          {dealNotes.length > 0 ? (
            <div className="space-y-6 mb-6">
              {dealNotes.map((note) => (
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
        customerName={contactName}
        link={{ dealId: deal.id }}
        onSaved={() => router.refresh()}
      />

      <CreateTaskModal
        open={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        customerName={contactName}
        link={{ dealId: deal.id }}
        onSaved={() => router.refresh()}
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
      <DeleteConfirmModal
        open={activityToDelete !== null}
        onClose={() => setActivityToDelete(null)}
        onConfirm={confirmDeleteActivity}
        title="Delete this activity?"
        description="This activity will be permanently removed from the timeline. This action cannot be undone."
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
    </Page>
  );
}
