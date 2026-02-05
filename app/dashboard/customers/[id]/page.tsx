"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Button,
  Badge,
  Progress,
  Textarea,
  EnvelopeIcon,
  PhoneIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  FileTextIcon,
  VideoIcon,
  NoteIcon,
  ActionMenu,
  EyeIcon,
  TrashIcon,
  PencilSimpleIcon,
} from "@/components/ui";
import {
  activityByCustomerId,
  getCustomerById,
  notesByCustomerId,
  dealsByCustomerId,
  stageConfig,
} from "@/lib/data/customers";
import { cn } from "@/lib/utils";
import {
  CompleteMeetingModal,
  ScheduleMeetingModal,
  ActivityDetailDrawer,
  CreateTaskModal,
  CreateInvoiceModal,
  AddDealModal,
} from "@/components/features";
import { usePageHeader } from "@/hooks";

// Icon mapping for activity types
const activityIconMap = {
  email: EnvelopeIcon,
  call: PhoneIcon,
  deal: CurrencyDollarIcon,
  meeting: VideoIcon,
  note: NoteIcon,
  task: CheckCircleIcon,
  invoice: FileTextIcon,
};

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const customer = getCustomerById(id);

  const activityItems = activityByCustomerId[id] || [];
  const customerNotes = notesByCustomerId[id] || [];
  const customerDeals = dealsByCustomerId[id] || [];

  const [activeTab, setActiveTab] = useState<"activity" | "deals">("activity");
  const [newNote, setNewNote] = useState("");
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<
    (typeof activityItems)[0] | null
  >(null);
  const [showActivityDrawer, setShowActivityDrawer] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showDealModal, setShowDealModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

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
        <Link href={`/dashboard/customers/${id}/edit`}>
          <Button variant="outline" leftIcon={<PencilSimpleIcon size={16} />}>
            Edit Customer
          </Button>
        </Link>
        <ActionMenu
          items={[
            {
              label: "Delete Customer",
              icon: <TrashIcon size={16} />,
              variant: "danger",
              onClick: () => {},
            },
          ]}
        />
      </>
    ),
    [id],
  );

  usePageHeader({
    backHref: "/dashboard/customers",
    actions: headerActions,
    breadcrumbLabel: customer?.name,
  });

  if (!customer) {
    return (
      <div className="py-20 text-center">
        <p className="text-neutral-500 dark:text-neutral-400 mb-4">
          Customer not found
        </p>
        <Link
          href="/dashboard/customers"
          className="text-sm text-neutral-950 dark:text-neutral-50 hover:underline"
        >
          Back to customers
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
            <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-neutral-200 dark:border-neutral-700">
              <Image
                src={customer.avatar}
                alt={customer.name}
                fill
                className="object-cover"
              />
            </div>
            <div>
              <h1 className="text-2xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
                {customer.name}
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
                {customer.email}
              </p>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    customer.status === "active"
                      ? "green"
                      : customer.status === "pending"
                        ? "amber"
                        : "neutral"
                  }
                >
                  {customer.status.charAt(0).toUpperCase() +
                    customer.status.slice(1)}
                </Badge>
                <Badge
                  variant={
                    customer.plan === "enterprise"
                      ? "violet"
                      : customer.plan === "pro"
                        ? "blue"
                        : "neutral"
                  }
                >
                  {customer.plan.charAt(0).toUpperCase() +
                    customer.plan.slice(1)}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" leftIcon={<PhoneIcon size={18} />}>
              Call
            </Button>
            <Button leftIcon={<EnvelopeIcon size={18} />}>Send Email</Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 text-center">
            <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              {formatCurrency(customer.mrr)}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Monthly Revenue
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 text-center">
            <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              {customer.healthScore}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Health Score
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 text-center">
            <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              ${(customer.lifetimeValue / 1000).toFixed(1)}K
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Lifetime Value
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 text-center">
            <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              {customer.tenure} mo
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Tenure
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content - Left 2 columns */}
        <div className="col-span-2 space-y-6">
          {/* Activity / Deals Tabs */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
            <div className="flex border-b border-neutral-200 dark:border-neutral-800">
              <button
                onClick={() => setActiveTab("activity")}
                className={`px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === "activity"
                    ? "text-neutral-950 dark:text-neutral-50 border-b-2 border-neutral-950 dark:border-neutral-50 -mb-px"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50"
                }`}
              >
                Activity
              </button>
              <button
                onClick={() => setActiveTab("deals")}
                className={`px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === "deals"
                    ? "text-neutral-950 dark:text-neutral-50 border-b-2 border-neutral-950 dark:border-neutral-50 -mb-px"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50"
                }`}
              >
                Deals
              </button>
            </div>
            <div>
              {activeTab === "activity" && (
                <>
                  {activityItems.length > 0 ? (
                    <div className="space-y-1">
                      {activityItems.map((item, index) => {
                        const Icon = activityIconMap[item.type];
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
                </>
              )}
              {activeTab === "deals" && (
                <>
                  {customerDeals.length > 0 ? (
                    <div className="p-4 space-y-4">
                      {customerDeals.map((deal) => {
                        const isClosed =
                          deal.stage === "closed_won" ||
                          deal.stage === "closed_lost";
                        return (
                          <div
                            key={deal.id}
                            className={cn(
                              "rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 overflow-hidden transition-all hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-sm",
                              isClosed && "opacity-70 hover:opacity-100",
                            )}
                          >
                            {/* Card Header */}
                            <div className="flex items-center justify-between px-4 py-3.5 border-b border-neutral-200 dark:border-neutral-800">
                              <div>
                                <p className="text-[15px] font-semibold text-neutral-950 dark:text-neutral-50">
                                  {deal.name}
                                </p>
                                <p className="text-[13px] text-neutral-500 dark:text-neutral-400">
                                  {deal.company}
                                </p>
                              </div>
                              <p className="text-xl font-serif text-neutral-950 dark:text-neutral-50">
                                {deal.value}/{deal.valuePeriod}
                              </p>
                            </div>

                            {/* Card Body */}
                            <div className="px-4 py-3.5 space-y-3.5">
                              {/* Stage */}
                              <div className="flex items-center gap-3">
                                <span className="text-[13px] text-neutral-500 dark:text-neutral-400 w-20">
                                  Stage
                                </span>
                                <Badge
                                  variant={stageConfig[deal.stage].variant}
                                >
                                  {stageConfig[deal.stage].label}
                                </Badge>
                              </div>

                              {/* Probability - only show if not closed */}
                              {!isClosed && (
                                <div className="flex items-center gap-3">
                                  <span className="text-[13px] text-neutral-500 dark:text-neutral-400 w-20">
                                    Probability
                                  </span>
                                  <Progress
                                    value={deal.probability}
                                    color="green"
                                    className="flex-1"
                                  />
                                  <span className="text-[13px] font-medium text-neutral-950 dark:text-neutral-50 w-10 text-right">
                                    {deal.probability}%
                                  </span>
                                </div>
                              )}

                              {/* Dates */}
                              <div className="flex items-center gap-6">
                                <div>
                                  <span className="text-xs text-neutral-400 dark:text-neutral-500 block mb-0.5">
                                    Created
                                  </span>
                                  <span className="text-[13px] font-medium text-neutral-950 dark:text-neutral-50">
                                    {deal.createdDate}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-xs text-neutral-400 dark:text-neutral-500 block mb-0.5">
                                    {isClosed ? "Closed" : "Expected Close"}
                                  </span>
                                  <span className="text-[13px] font-medium text-neutral-950 dark:text-neutral-50">
                                    {deal.expectedCloseDate}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-neutral-500 dark:text-neutral-400">
                      <p>No deals to display</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
              <h2 className="text-xl font-serif text-neutral-950 dark:text-neutral-50">
                Details
              </h2>
              <Link href={`/dashboard/customers/${customer.id}/edit`}>
                <button className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors">
                  Edit Customer
                </button>
              </Link>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                <div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                    Phone
                  </p>
                  <p className="text-sm text-neutral-950 dark:text-neutral-50">
                    {customer.phone}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                    Company
                  </p>
                  <p className="text-sm text-neutral-950 dark:text-neutral-50">
                    {customer.company}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                    Job Title
                  </p>
                  <p className="text-sm text-neutral-950 dark:text-neutral-50">
                    {customer.jobTitle}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                    Industry
                  </p>
                  <p className="text-sm text-neutral-950 dark:text-neutral-50">
                    {customer.industry}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                    Website
                  </p>
                  <p className="text-sm text-neutral-950 dark:text-neutral-50">
                    {customer.website}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                    Company Size
                  </p>
                  <p className="text-sm text-neutral-950 dark:text-neutral-50">
                    {customer.companySize}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                    Location
                  </p>
                  <p className="text-sm text-neutral-950 dark:text-neutral-50">
                    {customer.location}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                    Timezone
                  </p>
                  <p className="text-sm text-neutral-950 dark:text-neutral-50">
                    {customer.timezone}
                  </p>
                </div>
              </div>
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
              {customerNotes.length > 0 ? (
                <div className="space-y-6 mb-6">
                  {customerNotes.map((note) => (
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
                  Create Task
                </span>
              </button>
              <button
                onClick={() => setShowDealModal(true)}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <div className="w-10 h-10 rounded-full border border-neutral-200 dark:border-neutral-400/30 bg-white dark:bg-neutral-400/15 flex items-center justify-center">
                  <CurrencyDollarIcon
                    size={18}
                    className="text-neutral-600 dark:text-neutral-400"
                  />
                </div>
                <span className="text-sm font-medium text-neutral-950 dark:text-white">
                  Create Deal
                </span>
              </button>
              <button
                onClick={() => setShowInvoiceModal(true)}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <div className="w-10 h-10 rounded-full border border-neutral-200 dark:border-neutral-400/30 bg-white dark:bg-neutral-400/15 flex items-center justify-center">
                  <FileTextIcon
                    size={18}
                    className="text-neutral-600 dark:text-neutral-400"
                  />
                </div>
                <span className="text-sm font-medium text-neutral-950 dark:text-white">
                  Send Invoice
                </span>
              </button>
            </div>
          </div>

          {/* Health Score */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-4">
              Health Score
            </p>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                <span className="text-xl font-semibold text-green-600 dark:text-green-400">
                  {customer.healthScore}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {customer.healthScore >= 80
                    ? "Excellent"
                    : customer.healthScore >= 60
                      ? "Good"
                      : "At Risk"}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {customer.healthScore >= 80
                    ? "High engagement, active user"
                    : "Needs attention"}
                </p>
              </div>
            </div>
          </div>

          {/* Revenue */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-4">
              Revenue
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  Monthly Revenue
                </p>
                <p className="text-xl font-semibold text-neutral-950 dark:text-neutral-50">
                  {formatCurrency(customer.mrr)}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  +15% from last month
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  Lifetime Value
                </p>
                <p className="text-xl font-semibold text-neutral-950 dark:text-neutral-50">
                  {formatCurrency(customer.lifetimeValue)}
                </p>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-4">
              Tags
            </p>
            <div className="flex flex-wrap gap-2">
              {customer.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 text-xs rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Key Dates */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-4">
              Key Dates
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">
                  Customer Since
                </p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {customer.customerSince}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">
                  Last Contact
                </p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {customer.lastContact}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">
                  Renewal Date
                </p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {customer.renewalDate}
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
        customerName={customer.name}
      />

      {/* Activity Detail Drawer */}
      <ActivityDetailDrawer
        open={showActivityDrawer}
        onClose={() => setShowActivityDrawer(false)}
        activity={selectedActivity}
        customerName={customer.name}
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
        customerName={customer.name}
      />

      {/* Create Deal Modal */}
      <AddDealModal
        open={showDealModal}
        onClose={() => setShowDealModal(false)}
        mode="add"
        initialData={{
          name: "",
          customer: customer.name,
          value: "",
          stage: "discovery",
          probability: "25",
          expectedClose: "",
          notes: "",
        }}
        onSubmit={(data) => {
          console.log("Deal created:", data);
          setShowDealModal(false);
        }}
      />

      {/* Create Invoice Modal */}
      <CreateInvoiceModal
        open={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        customerPlan={customer.plan}
        customerMrr={customer.mrr}
      />
    </div>
  );
}
