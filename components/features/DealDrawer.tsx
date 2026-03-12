"use client";

import { useState, useEffect, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Drawer, Button, Badge, ArrowRightIcon } from "@/components/ui";
import {
  type PipelineDeal,
  type PipelineStage,
  pipelineStages,
  activeStageOrder,
  getStageLabel,
  formatDealCurrency,
} from "@/lib/data/sales";
import { cn } from "@/lib/utils";
import { MarkDealLostModal } from "./MarkDealLostModal";
import {
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

// ─── Info Row ────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
        {value}
      </span>
    </div>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: string }) {
  return (
    <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-4">
      {children}
    </p>
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

  // Fetch notes and activities when drawer opens
  useEffect(() => {
    if (open && deal?.id) {
      setIsLoadingData(true);
      Promise.all([getDealNotes(deal.id), getDealActivities(deal.id)]).then(
        ([notesRes, activitiesRes]) => {
          setNotes((notesRes.data ?? []) as DealNoteRecord[]);
          setActivities((activitiesRes.data ?? []) as DealActivityRecord[]);
          setIsLoadingData(false);
        },
      );
    }
  }, [open, deal?.id]);

  if (!deal) return null;

  const isClosed = deal.stage === "closed_won" || deal.stage === "closed_lost";
  const nextStage = getNextStage(deal.stage);

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
    { id: "activity", label: "Activity", count: activities.length },
    { id: "notes", label: "Notes", count: notes.length },
  ];

  return (
    <>
      <Drawer
        open={open && !showLostModal}
        onClose={onClose}
        title="Deal Details"
        footer={
          <div className="flex gap-3">
            {!isClosed && (
              <Button
                variant="outline"
                className="flex-1 border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-300 dark:hover:border-red-500/40"
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
        {/* Deal Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
          <div>
            <h3 className="text-2xl font-serif text-neutral-950 dark:text-neutral-50">
              {deal.name}
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {deal.company}
            </p>
          </div>
          <p className="text-2xl font-serif text-neutral-950 dark:text-neutral-50 sm:shrink-0">
            {formatDealCurrency(deal.value)}
          </p>
        </div>

        {/* Stage Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Stage
            </span>
            <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
              {getStageLabel(deal.stage)}
            </span>
          </div>
          <StageProgress currentStage={deal.stage} />
        </div>

        {/* Quick Actions */}
        {!isClosed && (
          <div className="flex gap-2 mb-5">
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
                className="border-green-200 dark:border-green-500/30 text-green-600 dark:text-green-400"
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

        {/* Tabs */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                activeTab === tab.id
                  ? "border-neutral-950 dark:border-neutral-50 text-neutral-950 dark:text-neutral-50"
                  : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300",
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700 px-1 text-[10px] font-semibold">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Deal Information */}
            <div>
              <SectionHeader>Deal Information</SectionHeader>
              <div className="divide-y-[0.5px] divide-neutral-200 dark:divide-neutral-800">
                <InfoRow label="Probability" value={`${deal.probability}%`} />
                <InfoRow label="Expected Close" value={deal.closeDate} />
                <InfoRow label="Created" value={deal.createdDate} />
                <InfoRow label="Last Activity" value={deal.lastActivity} />
              </div>
            </div>

            {/* Contact */}
            <div>
              <SectionHeader>Contact</SectionHeader>
              <div className="flex items-center justify-between rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-10 rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-700">
                    <Image
                      src={deal.contact.avatar}
                      alt={deal.contact.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                      {deal.contact.name}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {deal.contact.email}
                    </p>
                  </div>
                </div>
                <button className="text-sm font-medium text-neutral-950 dark:text-neutral-50 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">
                  View
                </button>
              </div>
            </div>

            {/* Quick Notes Preview */}
            {deal.notes && (
              <div>
                <SectionHeader>Notes</SectionHeader>
                <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/50 p-4">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    {deal.notes}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "activity" && (
          <div className="space-y-1">
            {isLoadingData ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  No activity recorded yet
                </p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[15px] top-2 bottom-2 w-px bg-neutral-200 dark:bg-neutral-800" />
                <div className="space-y-4">
                  {activities.map((activity) => {
                    const Icon = activityIcons[activity.type] || ClockIcon;
                    return (
                      <div key={activity.id} className="flex gap-3 relative">
                        <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                          <Icon size={14} className="text-neutral-500 dark:text-neutral-400" />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50 truncate">
                              {activity.title}
                            </p>
                            {activity.badge_label && (
                              <Badge
                                variant={(activity.badge_variant as "green" | "amber" | "blue" | "red" | "neutral") || "neutral"}
                              >
                                {activity.badge_label}
                              </Badge>
                            )}
                          </div>
                          {activity.description && (
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                              {activity.description}
                            </p>
                          )}
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
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
          <div className="space-y-4">
            {/* Add Note Form */}
            <div className="flex gap-2">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                className="flex-1 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-950 dark:text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950 dark:focus:ring-neutral-50 resize-none"
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
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
              </div>
            ) : notes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  No notes yet. Add one above.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-neutral-950 dark:text-neutral-50">
                        {note.author_name}
                      </p>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500">
                        {new Date(note.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      {note.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
