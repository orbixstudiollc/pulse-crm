"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
  ActionMenu,
  TrashIcon,
  PencilSimpleIcon,
} from "@/components/ui";
import { ActivityRow, type ActivityRowType, ConfirmModal } from "@/components/dashboard";
import { cn } from "@/lib/utils";
import {
  CompleteMeetingModal,
  ScheduleMeetingModal,
  ActivityDetailDrawer,
  CreateTaskModal,
  CreateInvoiceModal,
  AddDealModal,
  type DealFormData,
} from "@/components/features";
import { usePageHeader } from "@/hooks";
import { addCustomerNote, deleteCustomer } from "@/lib/actions/customers";
import { createDeal } from "@/lib/actions/deals";
import { toast } from "sonner";

// --- Types matching DB rows ---

interface CustomerRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  status: string;
  plan: string;
  mrr?: number | null;
  monthly_revenue?: number | null;
  health_score?: number | null;
  lifetime_value?: number | null;
  tenure?: number | null;
  tenure_months?: number | null;
  last_contact: string | null;
  company: string | null;
  job_title: string | null;
  industry: string | null;
  company_size: string | null;
  website: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  timezone: string | null;
  customer_since: string | null;
  renewal_date: string | null;
  tags: string[] | null;
  notes: string | null;
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
  [key: string]: unknown;
}

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
  created_at: string;
  [key: string]: unknown;
}

interface CustomerDetailClientProps {
  customer: CustomerRow;
  notes: NoteRow[] | undefined;
  activities: ActivityRow2[] | undefined;
  deals: DealRow[] | undefined;
}

// --- Stage config for deal badges ---

const stageConfig: Record<string, { label: string; variant: string }> = {
  discovery: { label: "Discovery", variant: "blue" },
  prospecting: { label: "Prospecting", variant: "blue" },
  qualification: { label: "Qualification", variant: "amber" },
  proposal: { label: "Proposal", variant: "violet" },
  negotiation: { label: "Negotiation", variant: "amber" },
  closed_won: { label: "Closed Won", variant: "green" },
  closed_lost: { label: "Closed Lost", variant: "red" },
};

// --- Component ---

export function CustomerDetailClient({
  customer,
  notes,
  activities,
  deals,
}: CustomerDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const customerName = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(" ") || customer.email;

  const customerNotes = notes || [];
  const activityItems = activities || [];
  const customerDeals = deals || [];

  const [activeTab, setActiveTab] = useState<"activity" | "deals">("activity");
  const [newNote, setNewNote] = useState("");
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityRow2 | null>(null);
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
      const res = await addCustomerNote(customer.id, newNote.trim());
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
      const res = await deleteCustomer(customer.id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Customer deleted");
        router.push("/dashboard/customers");
      }
    });
  };

  const handleCreateDeal = (data: DealFormData) => {
    startTransition(async () => {
      const res = await createDeal({
        name: data.name,
        company: customer.company || "",
        contact_name: customerName,
        value: parseFloat(data.value) || 0,
        stage: data.stage || "discovery",
        probability: parseInt(data.probability) || 25,
        expected_close_date: data.expectedClose || null,
        customer_id: customer.id,
        notes: data.notes || "",
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Deal created");
        setShowDealModal(false);
        router.refresh();
      }
    });
  };

  const headerActions = useMemo(
    () => (
      <>
        <Link href={`/dashboard/customers/${customer.id}/edit`}>
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
              onClick: handleDelete,
            },
          ]}
        />
      </>
    ),
    [customer.id],
  );

  usePageHeader({
    backHref: "/dashboard/customers",
    actions: headerActions,
    breadcrumbLabel: customerName,
  });

  const mrr = customer.mrr || customer.monthly_revenue || 0;
  const healthScore = customer.health_score || 0;
  const ltv = customer.lifetime_value || 0;
  const tenure = customer.tenure || customer.tenure_months || 0;

  return (
    <div className="min-h-full bg-neutral-100 dark:bg-neutral-900 p-4 sm:p-6 lg:p-8">
      {/* Header + Stats Card */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 mb-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-neutral-200 dark:border-neutral-700">
              <Image
                src={customer.avatar_url || "/images/avatars/default.svg"}
                alt={customerName}
                fill
                className="object-cover"
              />
            </div>
            <div>
              <h1 className="text-2xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
                {customerName}
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
              <span className="hidden sm:inline">Call</span>
            </Button>
            <Button leftIcon={<EnvelopeIcon size={18} />}>
              <span className="hidden sm:inline">Send Email</span>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 text-center">
            <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              {formatCurrency(mrr)}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Monthly Revenue
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 text-center">
            <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              {healthScore}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Health Score
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 text-center">
            <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              ${(ltv / 1000).toFixed(1)}K
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Lifetime Value
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 text-center">
            <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              {tenure} mo
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Tenure
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left 2 columns */}
        <div className="lg:col-span-2 space-y-6">
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
                        const stage = stageConfig[deal.stage] || {
                          label: deal.stage,
                          variant: "neutral",
                        };
                        return (
                          <Link
                            key={deal.id}
                            href={`/dashboard/sales/${deal.id}`}
                            className={cn(
                              "block rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 overflow-hidden transition-all hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-sm",
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
                                  {deal.company || customerName}
                                </p>
                              </div>
                              <p className="text-xl font-serif text-neutral-950 dark:text-neutral-50">
                                {formatCurrency(deal.value || 0)}
                              </p>
                            </div>

                            {/* Card Body */}
                            <div className="px-4 py-3.5 space-y-3.5">
                              {/* Stage */}
                              <div className="flex items-center gap-3">
                                <span className="text-[13px] text-neutral-500 dark:text-neutral-400 w-20">
                                  Stage
                                </span>
                                <Badge variant={stage.variant as any}>
                                  {stage.label}
                                </Badge>
                              </div>

                              {/* Probability - only show if not closed */}
                              {!isClosed && (
                                <div className="flex items-center gap-3">
                                  <span className="text-[13px] text-neutral-500 dark:text-neutral-400 w-20">
                                    Probability
                                  </span>
                                  <Progress
                                    value={deal.probability || 0}
                                    color="green"
                                    className="flex-1"
                                  />
                                  <span className="text-[13px] font-medium text-neutral-950 dark:text-neutral-50 w-10 text-right">
                                    {deal.probability || 0}%
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
                                    {formatDate(deal.created_at)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-xs text-neutral-400 dark:text-neutral-500 block mb-0.5">
                                    {isClosed ? "Closed" : "Expected Close"}
                                  </span>
                                  <span className="text-[13px] font-medium text-neutral-950 dark:text-neutral-50">
                                    {formatDate(deal.expected_close_date || deal.close_date || null)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </Link>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                <div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                    Phone
                  </p>
                  <p className="text-sm text-neutral-950 dark:text-neutral-50">
                    {customer.phone || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                    Company
                  </p>
                  <p className="text-sm text-neutral-950 dark:text-neutral-50">
                    {customer.company || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                    Job Title
                  </p>
                  <p className="text-sm text-neutral-950 dark:text-neutral-50">
                    {customer.job_title || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                    Industry
                  </p>
                  <p className="text-sm text-neutral-950 dark:text-neutral-50">
                    {customer.industry || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                    Website
                  </p>
                  <p className="text-sm text-neutral-950 dark:text-neutral-50">
                    {customer.website || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                    Company Size
                  </p>
                  <p className="text-sm text-neutral-950 dark:text-neutral-50">
                    {customer.company_size || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                    Location
                  </p>
                  <p className="text-sm text-neutral-950 dark:text-neutral-50">
                    {[customer.city, customer.state, customer.country]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                    Timezone
                  </p>
                  <p className="text-sm text-neutral-950 dark:text-neutral-50">
                    {customer.timezone || "—"}
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
                className="flex flex-col items-center gap-2 p-4 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
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
                className="flex flex-col items-center gap-2 p-4 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
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
                className="flex flex-col items-center gap-2 p-4 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
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
                className="flex flex-col items-center gap-2 p-4 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
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
                  {healthScore}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {healthScore >= 80
                    ? "Excellent"
                    : healthScore >= 60
                      ? "Good"
                      : "At Risk"}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {healthScore >= 80
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
                  {formatCurrency(mrr)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  Lifetime Value
                </p>
                <p className="text-xl font-semibold text-neutral-950 dark:text-neutral-50">
                  {formatCurrency(ltv)}
                </p>
              </div>
            </div>
          </div>

          {/* Tags */}
          {customer.tags && customer.tags.length > 0 && (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-4">
                Tags
              </p>
              <div className="flex flex-wrap gap-2">
                {customer.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 text-xs rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

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
                  {formatDate(customer.customer_since)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">
                  Last Contact
                </p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {formatDate(customer.last_contact)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">
                  Renewal Date
                </p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {formatDate(customer.renewal_date)}
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
        customerName={customerName}
      />

      {/* Activity Detail Drawer */}
      <ActivityDetailDrawer
        open={showActivityDrawer}
        onClose={() => setShowActivityDrawer(false)}
        activity={selectedActivity ? { ...selectedActivity, description: selectedActivity.description ?? "", type: selectedActivity.type as "call" | "meeting" | "task" | "email" | "note" | "deal" | "invoice" } : null}
        customerName={customerName}
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
          setShowCompleteModal(false);
        }}
      />

      {/* Create Task Modal */}
      <CreateTaskModal
        open={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        customerName={customerName}
      />

      {/* Create Deal Modal */}
      <AddDealModal
        open={showDealModal}
        onClose={() => setShowDealModal(false)}
        mode="add"
        initialData={{
          name: "",
          customer: customerName,
          value: "",
          stage: "discovery",
          probability: "25",
          expectedClose: "",
          notes: "",
        }}
        onSubmit={handleCreateDeal}
      />

      {/* Create Invoice Modal */}
      <CreateInvoiceModal
        open={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        customerPlan={customer.plan}
        customerMrr={mrr}
      />
      <ConfirmModal
        open={showDeleteConfirm}
        title="Delete Customer"
        message="Are you sure you want to delete this customer? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={executeDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
