"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
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
  EyeIcon,
  TrashIcon,
  UsersThreeIcon,
  NoteIcon,
  VideoIcon,
  CurrencyDollarIcon,
  FileTextIcon,
  Toast,
  PencilSimpleIcon,
  DotsThreeIcon,
} from "@/components/ui";
import {
  getLeadById,
  leadStatusConfig,
  activityByLeadId,
  notesByLeadId,
  type LeadActivity,
} from "@/lib/data/leads";
import { cn } from "@/lib/utils";
import {
  ScheduleMeetingModal,
  CreateTaskModal,
  ActivityDetailDrawer,
  CompleteMeetingModal,
  ConvertLeadModal,
} from "@/components/features";
import { usePageHeader } from "@/hooks";

// Icon mapping for activity types
const activityIconMap: Record<
  string,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  email: EnvelopeIcon,
  call: PhoneIcon,
  deal: CurrencyDollarIcon,
  meeting: VideoIcon,
  note: NoteIcon,
  task: CheckCircleIcon,
  invoice: FileTextIcon,
};

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const lead = getLeadById(id);

  const activityItems = activityByLeadId[id] || [];
  const leadNotes = notesByLeadId[id] || [];

  const [newNote, setNewNote] = useState("");
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<LeadActivity | null>(
    null,
  );
  const [showActivityDrawer, setShowActivityDrawer] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const headerActions = useMemo(
    () => (
      <>
        <Button variant="outline" leftIcon={<PencilSimpleIcon size={16} />}>
          Edit Lead
        </Button>
        <ActionMenu
          items={[
            {
              label: "Delete Lead",
              icon: <TrashIcon size={16} />,
              variant: "danger",
              onClick: () => {},
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
    breadcrumbLabel: lead?.name,
  });

  if (!lead) {
    return (
      <div className="py-20 text-center">
        <p className="text-neutral-500 dark:text-neutral-400 mb-4">
          Lead not found
        </p>
        <Link
          href="/dashboard/leads"
          className="text-sm text-neutral-950 dark:text-neutral-50 hover:underline"
        >
          Back to leads
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-neutral-100 dark:bg-neutral-900 p-8">
      {/* Header + Stats Card */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 mb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-6">
            <Avatar
              name={lead.name}
              size="xl"
              className="h-20! w-20! text-2xl!"
            />
            <div>
              <h1 className="text-2xl font-serif text-neutral-950 dark:text-neutral-50 mb-2">
                {lead.name}
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
                {lead.company}
              </p>
              <div className="flex items-center gap-2">
                <Badge variant={leadStatusConfig[lead.status].variant} dot>
                  {leadStatusConfig[lead.status].label}
                </Badge>
                <Badge variant="neutral">{lead.source}</Badge>
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
              leftIcon={<UsersThreeIcon size={18} />}
              onClick={() => setShowConvertModal(true)}
            >
              Convert to Customer
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 text-center">
            <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              {formatCurrency(lead.estimatedValue)}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Est. Value
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 text-center">
            <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              {lead.winProbability}%
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Win Probability
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 text-center">
            <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              {lead.score}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Lead Score
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 text-center">
            <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              {lead.daysInPipeline}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Days in Pipeline
            </p>
          </div>
        </div>
      </div>

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
              {activityItems.length > 0 ? (
                <div className="space-y-1">
                  {activityItems.map((item, index) => {
                    const Icon = activityIconMap[item.type] || NoteIcon;
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-start gap-4 py-4 px-5 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors group",
                          index !== activityItems.length - 1 &&
                            "border-b-[0.5px] border-neutral-200 dark:border-neutral-800",
                        )}
                      >
                        <div className="w-9 h-9 rounded-full border-[0.5px] border-neutral-200 dark:border-neutral-400/30 bg-neutral-100 dark:bg-neutral-400/15 flex items-center justify-center shrink-0">
                          <Icon
                            size={18}
                            className="text-neutral-500 dark:text-neutral-400"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                            {item.title}
                          </p>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            {item.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            {item.badge && (
                              <Badge variant={item.badge.variant}>
                                {item.badge.label}
                              </Badge>
                            )}
                            {item.meta && (
                              <span className="text-xs text-neutral-400 dark:text-neutral-500">
                                · {item.meta}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <ActionMenu
                            items={[
                              {
                                label: "View Details",
                                icon: <EyeIcon size={16} />,
                                onClick: () => {
                                  setSelectedActivity(item);
                                  setShowActivityDrawer(true);
                                },
                              },
                              {
                                label: "Delete Activity",
                                icon: <TrashIcon size={16} />,
                                variant: "danger",
                                onClick: () => {},
                              },
                            ]}
                          />
                        </div>
                      </div>
                    );
                  })}
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

          {/* Contact Information */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-4">
              Contact Information
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">
                  Email
                </p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {lead.email}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">
                  Phone
                </p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {lead.phone}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">
                  LinkedIn
                </p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {lead.linkedin}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">
                  Location
                </p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {lead.location}
                </p>
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
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">
                  Company
                </p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {lead.company}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">
                  Employees
                </p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {lead.employees}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">
                  Website
                </p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {lead.website}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">
                  Industry
                </p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {lead.industry}
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
        customerName={lead.name}
      />

      {/* Activity Detail Drawer */}
      <ActivityDetailDrawer
        open={showActivityDrawer}
        onClose={() => setShowActivityDrawer(false)}
        activity={selectedActivity}
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

      {/* Complete Meeting Modal */}
      <CompleteMeetingModal
        open={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        onComplete={(data) => {
          console.log("Meeting completed:", data);
          setShowCompleteModal(false);
        }}
      />

      {/* Create Task Modal */}
      <CreateTaskModal
        open={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        customerName={lead.name}
      />

      {/* Convert Lead Modal */}
      <ConvertLeadModal
        open={showConvertModal}
        onClose={() => setShowConvertModal(false)}
        leadName={lead.name}
        onConvert={() => {
          setShowConvertModal(false);
          setShowToast(true);
        }}
      />

      <Toast
        open={showToast}
        onClose={() => setShowToast(false)}
        message={`${lead.name} has been converted to a customer`}
      />
    </div>
  );
}
