"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
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
} from "@/components/ui";
import { ActivityRow, type ActivityRowType } from "@/components/dashboard";
import {
  pipelineStages,
  activeStageOrder,
  getStageLabel,
  formatDealCurrency,
  getDealById,
  type PipelineStage,
  type DealActivity,
} from "@/lib/data/sales";
import { cn } from "@/lib/utils";
import {
  ScheduleMeetingModal,
  CreateTaskModal,
  ActivityDetailDrawer,
  MarkDealWonModal,
  MarkDealLostModal,
  AddDealModal,
} from "@/components/features";
import { usePageHeader } from "@/hooks";

/* Stage Progress Component */
function StageProgress({ currentStage }: { currentStage: PipelineStage }) {
  const currentIndex = activeStageOrder.indexOf(
    currentStage === "closed_lost" ? "closed_won" : currentStage,
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

/* Stage Dropdown */
function StageDropdown({
  currentStage,
  onChange,
}: {
  currentStage: PipelineStage;
  onChange: (stage: PipelineStage) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-sm font-medium text-neutral-950 dark:text-neutral-50 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
      >
        {getStageLabel(currentStage)}
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
          <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-lg z-20 py-1">
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

/* Stage Color Mapping */
const stageColorMap: Record<PipelineStage, string> = {
  discovery: "bg-blue-500",
  proposal: "bg-amber-500",
  negotiation: "bg-amber-500",
  closed_won: "bg-green-500",
  closed_lost: "bg-red-500",
};

/* Page Component */
export default function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const deal = getDealById(id);

  const [newNote, setNewNote] = useState("");
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showWonModal, setShowWonModal] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<DealActivity | null>(
    null,
  );
  const [showActivityDrawer, setShowActivityDrawer] = useState(false);
  const [currentStage, setCurrentStage] = useState<PipelineStage>(
    deal?.stage || "discovery",
  );

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
              onClick: () => {},
            },
          ]}
        />
      </>
    ),
    [setShowEditModal],
  );

  usePageHeader({
    backHref: "/dashboard/sales",
    actions: headerActions,
    breadcrumbLabel: deal?.name,
  });

  if (!deal) {
    return (
      <div className="py-20 text-center">
        <p className="text-neutral-500 dark:text-neutral-400 mb-4">
          Deal not found
        </p>
        <Link
          href="/dashboard/sales"
          className="text-sm text-neutral-950 dark:text-neutral-50 hover:underline"
        >
          Back to sales
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-neutral-100 dark:bg-neutral-900 p-8">
      {/* Header Card */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 mb-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <Badge variant="amber" className="mb-3">
              {getStageLabel(deal.stage)}
            </Badge>
            <h1 className="text-2xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              {deal.name} - {formatDealCurrency(deal.value)}
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {deal.company}
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

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 text-center">
            <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              {deal.daysInStage}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Days in Stage
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 text-center">
            <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              {deal.daysToClose}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Days to Close
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 text-center">
            <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              {deal.probability}%
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Probability
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 text-center">
            <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              {deal.activities.length}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Activities
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Main Content - Left 2 columns */}
        <div className="col-span-2 space-y-6">
          {/* Activity */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
              <h2 className="text-xl font-serif text-neutral-950 dark:text-neutral-50">
                Activity
              </h2>
            </div>
            <div>
              {deal.activities.length > 0 ? (
                <div>
                  {deal.activities.map((item) => (
                    <ActivityRow
                      key={item.id}
                      id={item.id}
                      type={item.type as ActivityRowType}
                      title={item.title}
                      description={item.description}
                      badge={item.badge}
                      meta={item.meta}
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
              {deal.dealNotes.length > 0 ? (
                <div className="space-y-6 mb-6">
                  {deal.dealNotes.map((note) => (
                    <div key={note.id}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                          {note.author}
                        </p>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500">
                          {note.date}
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
                  <Button size="sm">Add Note</Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - Right column */}
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
                  stageColorMap[currentStage],
                )}
              />
              <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                {getStageLabel(currentStage)}
              </span>
            </div>
            <div className="mb-4">
              <StageProgress currentStage={currentStage} />
            </div>
            <StageDropdown
              currentStage={currentStage}
              onChange={setCurrentStage}
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
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <div className="w-10 h-10 rounded-full border border-neutral-200 dark:border-neutral-400/30 bg-white dark:bg-neutral-400/15 flex items-center justify-center">
                  <CalendarBlankIcon
                    size={18}
                    className="text-neutral-600 dark:text-neutral-400"
                  />
                </div>
                <span className="text-sm font-medium text-neutral-950 dark:text-white">
                  Schedule Meeting
                </span>
              </button>
              <button
                onClick={() => setShowTaskModal(true)}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <div className="w-10 h-10 rounded-full border border-neutral-200 dark:border-neutral-400/30 bg-white dark:bg-neutral-400/15 flex items-center justify-center">
                  <CheckCircleIcon
                    size={18}
                    className="text-neutral-600 dark:text-neutral-400"
                  />
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
            <div className="flex items-center justify-between">
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

          {/* Details */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-4">
              Details
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">
                  Expected Close
                </p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {deal.closeDate}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">
                  Created
                </p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {deal.createdDate}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">
                  Owner
                </p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {deal.owner}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Meeting Modal */}
      <ScheduleMeetingModal
        open={showMeetingModal}
        onClose={() => setShowMeetingModal(false)}
        customerName={deal.contact.name}
      />

      {/* Create Task Modal */}
      <CreateTaskModal
        open={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        customerName={deal.contact.name}
      />

      {/* Activity Detail Drawer */}
      <ActivityDetailDrawer
        open={showActivityDrawer}
        onClose={() => setShowActivityDrawer(false)}
        activity={selectedActivity}
        customerName={deal.contact.name}
        onReschedule={() => {
          setShowActivityDrawer(false);
          setShowMeetingModal(true);
        }}
      />

      {/* Mark Deal Won Modal */}
      <MarkDealWonModal
        open={showWonModal}
        onClose={() => setShowWonModal(false)}
        dealValue={deal.value}
        onConfirm={(data) => {
          console.log("Deal won:", data);
          setShowWonModal(false);
        }}
      />

      {/* Mark Deal Lost Modal */}
      <MarkDealLostModal
        open={showLostModal}
        onClose={() => setShowLostModal(false)}
        onConfirm={(data) => {
          console.log("Deal lost:", data);
          setShowLostModal(false);
        }}
      />

      {/* Edit Deal Modal */}
      <AddDealModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        mode="edit"
        initialData={{
          name: deal.name,
          customer: deal.contact.name,
          value: deal.value.toString(),
          stage: deal.stage,
          probability: deal.probability.toString(),
          expectedClose: deal.closeDate,
          notes: deal.notes,
        }}
        onSubmit={(data) => {
          console.log("Deal updated:", data);
          setShowEditModal(false);
        }}
      />
    </div>
  );
}
