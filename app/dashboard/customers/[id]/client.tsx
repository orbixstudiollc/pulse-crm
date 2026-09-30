"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Badge,
  Avatar,
  Progress,
  Textarea,
  EnvelopeIcon,
  PhoneIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  ActionMenu,
  DeleteConfirmModal,
  TrashIcon,
  PencilSimpleIcon,
  type BadgeVariant,
} from "@/components/ui";
import {
  ActivityRow,
  type ActivityRowType,
  ConfirmModal,
  Page,
  PageHeader,
  MetricStrip,
  Metric,
  PageTabs,
  TableSection,
  Section,
  DetailLayout,
  PanelSection,
  KeyValueList,
  KeyValue,
} from "@/components/dashboard";
import { cn } from "@/lib/utils";
import { customerLifetimeValue, customerTenureMonths } from "@/lib/customers/metrics";
import {
  CompleteMeetingModal,
  ScheduleMeetingModal,
  ActivityDetailDrawer,
  CreateTaskModal,
  AddDealModal,
  type DealFormData,
} from "@/components/features";
import { usePageHeader } from "@/hooks";
import { addCustomerNote, deleteCustomer } from "@/lib/actions/customers";
import { createDeal } from "@/lib/actions/deals";
import { deleteActivity } from "@/lib/actions/activities";
import { deleteCalendarEvent } from "@/lib/actions/calendar";
import { deleteRecordActivity, type LinkedItem } from "@/lib/actions/record-activities";
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
  linkedItems?: LinkedItem[];
}

// Per-record activities ("record") merged with linked org activities / calendar events.
type FeedItem = ActivityRow2 & { source: "record" | LinkedItem["source"] };

// --- Stage config for deal badges ---

const stageConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  discovery: { label: "Discovery", variant: "info" },
  prospecting: { label: "Prospecting", variant: "info" },
  qualification: { label: "Qualification", variant: "warning" },
  proposal: { label: "Proposal", variant: "primary" },
  negotiation: { label: "Negotiation", variant: "warning" },
  closed_won: { label: "Closed Won", variant: "success" },
  closed_lost: { label: "Closed Lost", variant: "error" },
};

// --- Helpers ---

// --- Component ---

export function CustomerDetailClient({
  customer,
  notes,
  activities,
  linkedItems,
  deals,
}: CustomerDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<FeedItem | null>(null);

  const customerName = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(" ") || customer.email;

  const customerNotes = notes || [];
  const activityItems = useMemo<FeedItem[]>(
    () =>
      [
        ...(activities || []).map((a) => ({ ...a, source: "record" as const })),
        ...(linkedItems || []),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [activities, linkedItems],
  );
  const customerDeals = deals || [];

  const [activeTab, setActiveTab] = useState<"activity" | "deals">("activity");
  const [newNote, setNewNote] = useState("");
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityRow2 | null>(null);
  const [showActivityDrawer, setShowActivityDrawer] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showDealModal, setShowDealModal] = useState(false);

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
          ? await deleteRecordActivity("customer", item.id)
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
  const closedWonValue = customerDeals
    .filter((d) => d.stage === "closed_won")
    .reduce((sum, d) => sum + (d.value || 0), 0);
  const ltv = customerLifetimeValue(customer.lifetime_value, closedWonValue);
  const tenure = customerTenureMonths(customer.customer_since, customer.created_at);

  return (
    <Page>
      {/* Record header */}
      <PageHeader
        title={customerName}
        icon={
          <Avatar
            src={customer.avatar_url || undefined}
            name={customerName}
            size="sm"
            className="h-9! w-9! text-[13px]!"
          />
        }
        description={
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span>{customer.email}</span>
            <Badge
              variant={
                customer.status === "active"
                  ? "success"
                  : customer.status === "pending"
                    ? "warning"
                    : "neutral"
              }
            >
              {customer.status.charAt(0).toUpperCase() +
                customer.status.slice(1)}
            </Badge>
            <Badge
              variant={
                customer.plan === "enterprise"
                  ? "primary"
                  : customer.plan === "pro"
                    ? "info"
                    : "neutral"
              }
            >
              {customer.plan.charAt(0).toUpperCase() +
                customer.plan.slice(1)}
            </Badge>
          </div>
        }
      >
        {customer.phone && (
          <a href={`tel:${customer.phone}`}>
            <Button variant="outline" leftIcon={<PhoneIcon size={18} />}>
              <span className="hidden sm:inline">Call</span>
            </Button>
          </a>
        )}
        {customer.email && (
          <a href={`mailto:${customer.email}`}>
            <Button leftIcon={<EnvelopeIcon size={18} />}>
              <span className="hidden sm:inline">Send Email</span>
            </Button>
          </a>
        )}
      </PageHeader>

      {/* Metrics */}
      <MetricStrip>
        <Metric label="Monthly Revenue" value={formatCurrency(mrr)} />
        <Metric label="Health Score" value={healthScore || "—"} />
        <Metric label="Lifetime Value" value={ltv ? `$${(ltv / 1000).toFixed(1)}K` : "—"} />
        <Metric label="Tenure" value={tenure ? `${tenure} mo` : "—"} />
      </MetricStrip>

      {/* Activity / Deals Tabs */}
      <PageTabs
        tabs={[
          { id: "activity" as const, label: "Activity" },
          { id: "deals" as const, label: "Deals" },
        ]}
        value={activeTab}
        onChange={setActiveTab}
        className="max-sm:overflow-x-auto max-sm:overflow-y-hidden"
      />

      <DetailLayout
        aside={
          <>
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
                  Create Task
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<CurrencyDollarIcon size={16} />}
                  onClick={() => setShowDealModal(true)}
                >
                  Create Deal
                </Button>
              </div>
            </PanelSection>

            <PanelSection
              title="Details"
              actions={
                <Link href={`/dashboard/customers/${customer.id}/edit`}>
                  <button className="text-[13px] text-fg-secondary hover:text-fg transition-colors">
                    Edit Customer
                  </button>
                </Link>
              }
            >
              <KeyValueList>
                <KeyValue label="Phone">{customer.phone || "—"}</KeyValue>
                <KeyValue label="Company">{customer.company || "—"}</KeyValue>
                <KeyValue label="Job Title">{customer.job_title || "—"}</KeyValue>
                <KeyValue label="Industry">{customer.industry || "—"}</KeyValue>
                <KeyValue label="Website">{customer.website || "—"}</KeyValue>
                <KeyValue label="Company Size">{customer.company_size || "—"}</KeyValue>
                <KeyValue label="Location">
                  {[customer.city, customer.state, customer.country]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </KeyValue>
                <KeyValue label="Timezone">{customer.timezone || "—"}</KeyValue>
              </KeyValueList>
            </PanelSection>

            <PanelSection title="Health Score">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-success-surface flex items-center justify-center">
                  <span className="text-xl font-semibold text-success">
                    {healthScore || "—"}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-fg">
                    {!healthScore
                      ? "Not scored"
                      : healthScore >= 80
                      ? "Excellent"
                      : healthScore >= 60
                        ? "Good"
                        : "At Risk"}
                  </p>
                  <p className="text-xs text-fg-secondary">
                    {!healthScore
                      ? "No health score yet"
                      : healthScore >= 80
                      ? "High engagement, active user"
                      : "Needs attention"}
                  </p>
                </div>
              </div>
            </PanelSection>

            <PanelSection title="Revenue">
              <KeyValueList>
                <KeyValue label="Monthly Revenue">{formatCurrency(mrr)}</KeyValue>
                <KeyValue label="Lifetime Value">{ltv ? formatCurrency(ltv) : "—"}</KeyValue>
              </KeyValueList>
            </PanelSection>

            {customer.tags && customer.tags.length > 0 && (
              <PanelSection title="Tags">
                <div className="flex flex-wrap gap-2">
                  {customer.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 text-xs rounded bg-muted text-fg-secondary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </PanelSection>
            )}

            <PanelSection title="Key Dates">
              <KeyValueList>
                <KeyValue label="Customer Since">{formatDate(customer.customer_since)}</KeyValue>
                <KeyValue label="Last Contact">{formatDate(customer.last_contact)}</KeyValue>
                <KeyValue label="Renewal Date">{formatDate(customer.renewal_date)}</KeyValue>
              </KeyValueList>
            </PanelSection>
          </>
        }
      >
        {activeTab === "activity" && (
          <>
            {activityItems.length > 0 ? (
              <div className="px-4 max-sm:px-0">
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
          </>
        )}

        {activeTab === "deals" && (
          <>
            {customerDeals.length > 0 ? (
              <TableSection flush>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left">Name</th>
                        <th className="text-left">Stage</th>
                        <th className="text-left">Probability</th>
                        <th className="text-left">Created</th>
                        <th className="text-left">Expected Close</th>
                        <th className="text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerDeals.map((deal) => {
                        const isClosed =
                          deal.stage === "closed_won" ||
                          deal.stage === "closed_lost";
                        const stage = stageConfig[deal.stage] || {
                          label: deal.stage,
                          variant: "neutral",
                        };
                        return (
                          <tr
                            key={deal.id}
                            className={cn(isClosed && "opacity-70 hover:opacity-100")}
                          >
                            <td>
                              <Link
                                href={`/dashboard/sales/${deal.id}`}
                                className="flex items-center gap-2 min-w-0"
                              >
                                <CurrencyDollarIcon size={16} className="shrink-0 text-fg-muted" />
                                <span className="min-w-0">
                                  <span className="block text-[13px] font-medium text-fg truncate">
                                    {deal.name}
                                  </span>
                                  <span className="block text-[12px] text-fg-muted truncate">
                                    {deal.company || customerName}
                                  </span>
                                </span>
                              </Link>
                            </td>
                            <td>
                              <Badge variant={stage.variant}>
                                {stage.label}
                              </Badge>
                            </td>
                            <td>
                              {!isClosed && (
                                <div className="flex items-center gap-3 min-w-[140px]">
                                  <Progress
                                    value={deal.probability || 0}
                                    color="green"
                                    className="flex-1"
                                  />
                                  <span className="text-[13px] font-medium text-fg w-10 text-right">
                                    {deal.probability || 0}%
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="text-[13px] text-fg">
                              {formatDate(deal.created_at)}
                            </td>
                            <td className="text-[13px] text-fg">
                              {formatDate(deal.expected_close_date || deal.close_date || null)}
                              {isClosed && (
                                <span className="ml-1.5 text-fg-muted">Closed</span>
                              )}
                            </td>
                            <td className="text-right text-[13px] font-semibold text-fg">
                              {formatCurrency(deal.value || 0)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </TableSection>
            ) : (
              <div className="py-12 text-center text-fg-secondary">
                <p>No deals to display</p>
              </div>
            )}
          </>
        )}

        {/* Notes */}
        <Section
          title="Notes"
          className={cn(activeTab === "deals" && customerDeals.length > 0 && "border-t-0")}
        >
          {customerNotes.length > 0 ? (
            <div className="space-y-6 mb-6">
              {customerNotes.map((note) => (
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

      {/* Schedule Meeting Modal */}
      <ScheduleMeetingModal
        open={showMeetingModal}
        onClose={() => setShowMeetingModal(false)}
        customerName={customerName}
        link={{ customerId: customer.id }}
        onSaved={() => router.refresh()}
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
        link={{ customerId: customer.id }}
        customerName={customerName}
        onSaved={() => router.refresh()}
      />

      {/* Create Task Modal */}
      <CreateTaskModal
        open={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        customerName={customerName}
        link={{ customerId: customer.id }}
        onSaved={() => router.refresh()}
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

      <DeleteConfirmModal
        open={activityToDelete !== null}
        onClose={() => setActivityToDelete(null)}
        onConfirm={confirmDeleteActivity}
        title="Delete this activity?"
        description="This activity will be permanently removed from the timeline. This action cannot be undone."
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
    </Page>
  );
}
