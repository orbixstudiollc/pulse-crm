"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { Drawer, Button, Badge, Avatar, ArrowRightIcon, type BadgeVariant } from "@/components/ui";
import {
  type PipelineDeal,
  type PipelineStage,
  activeStageOrder,
  getStageLabel,
  formatDealCurrency,
} from "@/lib/data/sales";
import { cn } from "@/lib/utils";
import { parseDealDate } from "@/lib/deals/metrics";
import { KeyValue, KeyValueList, PageTabs, PanelSection } from "@/components/dashboard/Page";
import { MarkDealLostModal } from "./MarkDealLostModal";
import {
  getDealById,
  getDealNotes,
  getDealActivities,
  addDealNote,
  updateDealStage,
  updateDeal,
  createDealActivity,
} from "@/lib/actions/deals";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  EnvelopeIcon,
  PhoneIcon,
  CalendarBlankIcon,
  NoteIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  VideoIcon,
  ArrowRightIcon as ArrowIcon,
  PlusIcon,
} from "@/components/ui/Icons";

interface DealDrawerProps {
  open: boolean;
  onClose: () => void;
  deal: PipelineDeal | null;
}

type DrawerTab = "overview" | "activity" | "notes";

// Fields read from the deal row, the same source the deal detail page uses
type DealRowDetails = {
  customer_id?: string | null;
  lead_id?: string | null;
  created_at?: string | null;
  last_activity?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_avatar?: string | null;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = parseDealDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type DealNoteRecord = {
  id: string;
  deal_id: string;
  author_id: string;
  author_name: string;
  content: string;
  created_at: string;
};

type DealActivityRecord = {
  id: string;
  deal_id: string;
  type: string;
  title: string;
  description: string | null;
  badge_label: string | null;
  badge_variant: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

const activityIcons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  email: EnvelopeIcon,
  call: PhoneIcon,
  meeting: VideoIcon,
  note: NoteIcon,
  task: CheckCircleIcon,
  deal: CurrencyDollarIcon,
  invoice: CurrencyDollarIcon,
};

// ─── Stage Progress ──────────────────────────────────────────────────────────

function StageProgress({ currentStage }: { currentStage: PipelineStage }) {
  const currentIndex = activeStageOrder.indexOf(
    currentStage === "closed_lost" ? "closed_won" : currentStage,
  );
  const isLost = currentStage === "closed_lost";

  return (
    <div className="flex gap-1.5">
      {activeStageOrder.map((stage, index) => {
        const isFilled = index <= currentIndex && !isLost;
        const isLostFilled = isLost && index <= currentIndex;

        return (
          <div
            key={stage}
            className={cn(
              "h-2 flex-1 rounded-full transition-colors",
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

// ─── Next Stage Helper ───────────────────────────────────────────────────────

function getNextStage(current: PipelineStage): PipelineStage | null {
  const order: PipelineStage[] = ["discovery", "proposal", "negotiation"];
  const idx = order.indexOf(current);
  if (idx === -1 || idx >= order.length - 1) return null;
  return order[idx + 1];
}

// ─── Deal Drawer ─────────────────────────────────────────────────────────────

export function DealDrawer({ open, onClose, deal }: DealDrawerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showLostModal, setShowLostModal] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>("overview");
  const [notes, setNotes] = useState<DealNoteRecord[]>([]);
  const [activities, setActivities] = useState<DealActivityRecord[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [contactHref, setContactHref] = useState<string | null>(null);
  const [details, setDetails] = useState<DealRowDetails | null>(null);

  // Mark data as loading when the drawer opens (adjusted during render, not in an effect)
  const loadKey = open && deal?.id ? deal.id : null;
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  if (loadKey !== loadingKey) {
    setLoadingKey(loadKey);
    setContactHref(null);
    setDetails(null);
    if (loadKey) setIsLoadingData(true);
  }

  // Fetch notes and activities when drawer opens
  useEffect(() => {
    if (open && deal?.id) {
      Promise.all([
        getDealNotes(deal.id),
        getDealActivities(deal.id),
        getDealById(deal.id),
      ]).then(([notesRes, activitiesRes, dealRes]) => {
        setNotes((notesRes.data ?? []) as DealNoteRecord[]);
        setActivities((activitiesRes.data ?? []) as DealActivityRecord[]);
        // Link the contact to the record this deal references, if any
        const row = dealRes.data as DealRowDetails | null;
        setDetails(row);
        setContactHref(
          row?.customer_id
            ? `/dashboard/customers/${row.customer_id}`
            : row?.lead_id
              ? `/dashboard/leads/${row.lead_id}`
              : null,
        );
        setIsLoadingData(false);
      });
    }
  }, [open, deal?.id]);

  if (!deal) return null;

  const isClosed = deal.stage === "closed_won" || deal.stage === "closed_lost";
  const nextStage = getNextStage(deal.stage);
  const contactName = deal.contact?.name || details?.contact_name || "Unknown Contact";
  const contactEmail = deal.contact?.email || details?.contact_email || "";
  const contactAvatar = deal.contact?.avatar || details?.contact_avatar || undefined;
  const lastActivity = details?.last_activity ?? activities[0]?.created_at ?? null;

  const handleMoveStage = (newStage: PipelineStage) => {
    startTransition(async () => {
      const result = await updateDealStage(deal.id, newStage);
      if (result.error) {
        toast.error("Failed to update stage");
      } else {
        toast.success(`Moved to ${getStageLabel(newStage)}`);
        router.refresh();
        onClose();
      }
    });
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    startTransition(async () => {
      const result = await addDealNote(deal.id, newNote.trim());
      if (result.error) {
        toast.error("Failed to add note");
      } else {
        setNotes((prev) => [result.data as DealNoteRecord, ...prev]);
        setNewNote("");
        toast.success("Note added");
      }
    });
  };

  const handleScheduleFollowUp = () => {
    startTransition(async () => {
      const result = await createDealActivity(deal.id, {
        type: "task",
        title: "Follow-up scheduled",
        description: `Follow-up task for ${deal.name}`,
      });
      if (result.error) {
        toast.error("Failed to schedule follow-up");
      } else {
        setActivities((prev) => [result.data as DealActivityRecord, ...prev]);
        toast.success("Follow-up scheduled");
      }
    });
  };

  const tabs: { id: DrawerTab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "activity", label: "Activity", count: activities.length || undefined },
    { id: "notes", label: "Notes", count: notes.length || undefined },
  ];

  return (
    <>
      <Drawer
        open={open && !showLostModal}
        onClose={onClose}
        title="Deal Details"
        footer={
          <div className="flex gap-2">
            {!isClosed && (
              <Button
                variant="outline"
                className="flex-1 text-danger hover:bg-danger-surface"
                onClick={() => setShowLostModal(true)}
              >
                Mark Lost
              </Button>
            )}
            <Link href={`/dashboard/sales/${deal.id}`} className="flex-1">
              <Button
                className="w-full"
                rightIcon={<ArrowRightIcon size={18} />}
              >
                View Details
              </Button>
            </Link>
          </div>
        }
      >
        <div className="-m-4">
        {/* Deal Header */}
        <div className="px-6 py-5 border-t border-divider first:border-t-0">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
          <div>
            <h3 className="text-heading-lg text-fg">
              {deal.name}
            </h3>
            <p className="text-sm text-fg-secondary">
              {deal.company}
            </p>
          </div>
          <p className="text-[22px] font-semibold text-fg sm:shrink-0">
            {formatDealCurrency(deal.value)}
          </p>
        </div>

        {/* Stage Progress */}
        <div className="mb-4 last:mb-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-fg-secondary">
              Stage
            </span>
            <span className="text-sm font-medium text-fg">
              {getStageLabel(deal.stage)}
            </span>
          </div>
          <StageProgress currentStage={deal.stage} />
        </div>

        {/* Quick Actions */}
        {!isClosed && (
          <div className="flex gap-2">
            {nextStage && (
              <Button
                size="sm"
                onClick={() => handleMoveStage(nextStage)}
                disabled={isPending}
                rightIcon={<ArrowIcon size={14} />}
              >
                Move to {getStageLabel(nextStage)}
              </Button>
            )}
            {deal.stage === "negotiation" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleMoveStage("closed_won")}
                disabled={isPending}
                className="text-success"
              >
                Mark Won
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleScheduleFollowUp}
              disabled={isPending}
              leftIcon={<CalendarBlankIcon size={14} />}
            >
              Follow-up
            </Button>
          </div>
        )}

        </div>

        {/* Tabs */}
        <PageTabs tabs={tabs} value={activeTab} onChange={setActiveTab} className="px-6" />

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div>
            {/* Deal Information */}
            <PanelSection title="Deal Information">
              <KeyValueList>
                <KeyValue label="Probability">{`${deal.probability}%`}</KeyValue>
                <KeyValue label="Expected Close">{deal.closeDate}</KeyValue>
                <KeyValue label="Created">{formatDate(details?.created_at)}</KeyValue>
                <KeyValue label="Last Activity">{formatDate(lastActivity)}</KeyValue>
              </KeyValueList>
            </PanelSection>

            {/* Contact */}
            <PanelSection title="Contact">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar src={contactAvatar} name={contactName} size="md" />
                  <div>
                    <p className="text-sm font-medium text-fg">
                      {contactName}
                    </p>
                    {contactEmail && (
                      <p className="text-xs text-fg-secondary">
                        {contactEmail}
                      </p>
                    )}
                  </div>
                </div>
                {contactHref && (
                  <Link
                    href={contactHref}
                    className="text-sm font-medium text-fg hover:text-fg-secondary transition-colors"
                  >
                    View
                  </Link>
                )}
              </div>
            </PanelSection>

            {/* Quick Notes Preview */}
            {deal.notes && (
              <PanelSection title="Notes">
                <p className="text-sm text-fg-secondary leading-relaxed">
                  {deal.notes}
                </p>
              </PanelSection>
            )}
          </div>
        )}

        {activeTab === "activity" && (
          <div className="px-6 py-5 space-y-1">
            {isLoadingData ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border border-line border-t-fg" />
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-fg-secondary">
                  No activity recorded yet
                </p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[15px] top-2 bottom-2 w-px bg-active" />
                <div className="space-y-4">
                  {activities.map((activity) => {
                    const Icon = activityIcons[activity.type] || ClockIcon;
                    return (
                      <div key={activity.id} className="flex gap-3 relative">
                        <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted border border-line">
                          <Icon size={14} className="text-fg-secondary" />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-fg truncate">
                              {activity.title}
                            </p>
                            {activity.badge_label && (
                              <Badge
                                variant={(activity.badge_variant as BadgeVariant) || "neutral"}
                              >
                                {activity.badge_label}
                              </Badge>
                            )}
                          </div>
                          {activity.description && (
                            <p className="text-xs text-fg-secondary mt-0.5 truncate">
                              {activity.description}
                            </p>
                          )}
                          <p className="text-xs text-fg-muted mt-1">
                            {new Date(activity.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "notes" && (
          <div className="px-6 py-5 space-y-4">
            {/* Add Note Form */}
            <div className="flex gap-2">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              />
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={!newNote.trim() || isPending}
                leftIcon={<PlusIcon size={14} />}
                className="self-end"
              >
                Add
              </Button>
            </div>

            {/* Notes List */}
            {isLoadingData ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border border-line border-t-fg" />
              </div>
            ) : notes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-fg-secondary">
                  No notes yet. Add one above.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-divider">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-fg">
                        {note.author_name}
                      </p>
                      <p className="text-xs text-fg-muted">
                        {new Date(note.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <p className="text-sm text-fg-secondary leading-relaxed">
                      {note.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      </Drawer>

      {/* Mark Deal Lost Modal */}
      <MarkDealLostModal
        open={showLostModal}
        onClose={() => setShowLostModal(false)}
        onConfirm={(data) => {
          startTransition(async () => {
            const stageResult = await updateDealStage(deal.id, "closed_lost");
            if (stageResult.error) {
              toast.error("Failed to mark deal as lost");
              return;
            }
            const lossNotes = `Lost - Reason: ${data.reason}${data.competitor ? `, Competitor: ${data.competitor}` : ""}${data.notes ? `. ${data.notes}` : ""}`;
            await updateDeal(deal.id, { notes: lossNotes });
            toast.success("Deal marked as lost");
            router.refresh();
            setShowLostModal(false);
            onClose();
          });
        }}
      />
    </>
  );
}
