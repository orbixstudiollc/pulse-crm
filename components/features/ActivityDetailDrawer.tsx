"use client";

import { Drawer, Badge, Button, CalendarBlankIcon } from "@/components/ui";

interface ActivityDetail {
  id: string;
  type: "email" | "call" | "deal" | "meeting" | "note" | "task" | "invoice";
  title: string;
  description: string;
  badge?: {
    label: string;
    variant:
      | "green"
      | "amber"
      | "blue"
      | "red"
      | "emerald"
      | "violet"
      | "neutral";
  };
  meta?: string;
}

interface ActivityDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  activity: ActivityDetail | null;
  customerName: string;
  onMarkComplete?: () => void;
  onReschedule?: () => void;
  onEditTask?: () => void;
  onEditDeal?: () => void;
  onMoveToNextStage?: () => void;
  onDownloadPdf?: () => void;
  onMarkAsPaid?: () => void;
}

// ── Detail row ──────────────────────────────────────────────────────────────
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
        {value}
      </p>
    </div>
  );
}

// Wrapper for Badge rows to match DetailRow padding
function BadgeRow({
  label,
  badgeLabel,
  badgeVariant,
}: {
  label: string;
  badgeLabel: string;
  badgeVariant: NonNullable<ActivityDetail["badge"]>["variant"];
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{label}</p>
      <Badge variant={badgeVariant}>{badgeLabel}</Badge>
    </div>
  );
}

// ── Section header ──────────────────────────────────────────────────────────
function SectionHeader({ children }: { children: string }) {
  return (
    <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-4">
      {children}
    </p>
  );
}

// ── Description block ───────────────────────────────────────────────────────
function DescriptionBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="mb-6">
      <SectionHeader>{label}</SectionHeader>
      <div className="rounded bg-neutral-50 dark:bg-neutral-800/50 p-4">
        <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
          {text}
        </p>
      </div>
    </div>
  );
}

// ── Type-specific detail sections ───────────────────────────────────────────

function MeetingDetails({
  activity,
  customerName,
}: {
  activity: ActivityDetail;
  customerName: string;
}) {
  const isCompleted =
    activity.badge?.label === "Completed" ||
    activity.badge?.label === "Cancelled";

  return (
    <>
      <div className="mb-6">
        <SectionHeader>Details</SectionHeader>
        <div className="divide-y-[0.5px] divide-neutral-200 dark:divide-neutral-800">
          {activity.badge && (
            <BadgeRow
              label="Status"
              badgeLabel={activity.badge.label}
              badgeVariant={activity.badge.variant}
            />
          )}
          {activity.meta && (
            <DetailRow label="Date & Time" value={activity.meta} />
          )}
          <DetailRow
            label="Attendees"
            value={`${customerName}, You + 2 others`}
          />
        </div>
      </div>

      <DescriptionBlock label="Description" text={activity.description} />

      {!isCompleted && (
        <div>
          <SectionHeader>Add to Calendar</SectionHeader>
          <div className="flex flex-wrap gap-3">
            <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm font-medium text-neutral-950 dark:text-neutral-50 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
              <CalendarBlankIcon size={16} />
              Google Calendar
            </button>
            <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm font-medium text-neutral-950 dark:text-neutral-50 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
              <CalendarBlankIcon size={16} />
              Apple Calendar
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function TaskDetails({ activity }: { activity: ActivityDetail }) {
  return (
    <>
      <div className="mb-6">
        <SectionHeader>Details</SectionHeader>
        <div className="divide-y-[0.5px] divide-neutral-200 dark:divide-neutral-800">
          {activity.meta && (
            <DetailRow label="Due Date" value={activity.meta} />
          )}
          {activity.badge && (
            <DetailRow label="Priority" value={activity.badge.label} />
          )}
        </div>
      </div>

      <DescriptionBlock label="Description" text={activity.description} />
    </>
  );
}

function DealDetails({ activity }: { activity: ActivityDetail }) {
  return (
    <>
      <div className="mb-6">
        <SectionHeader>Details</SectionHeader>
        <div className="divide-y-[0.5px] divide-neutral-200 dark:divide-neutral-800">
          {activity.meta && <DetailRow label="Value" value={activity.meta} />}
          {activity.badge && (
            <DetailRow label="Stage" value={activity.badge.label} />
          )}
          <DetailRow label="Probability" value="50%" />
          <DetailRow label="Expected Close" value="Jan 31, 2025" />
        </div>
      </div>

      <DescriptionBlock label="Notes" text={activity.description} />
    </>
  );
}

function InvoiceDetails({ activity }: { activity: ActivityDetail }) {
  return (
    <>
      <div className="mb-6">
        <SectionHeader>Details</SectionHeader>
        <div className="divide-y-[0.5px] divide-neutral-200 dark:divide-neutral-800">
          {activity.meta && <DetailRow label="Amount" value={activity.meta} />}
          {activity.badge && (
            <DetailRow label="Status" value={activity.badge.label} />
          )}
          <DetailRow label="Due Date" value="Jan 18, 2026" />
          <DetailRow label="Payment Terms" value="Net 30" />
        </div>
      </div>

      <DescriptionBlock label="Description" text={activity.description} />
    </>
  );
}

function GenericDetails({ activity }: { activity: ActivityDetail }) {
  return (
    <>
      <div className="mb-6">
        <SectionHeader>Details</SectionHeader>
        <div className="divide-y-[0.5px] divide-neutral-200 dark:divide-neutral-800">
          {activity.badge && (
            <BadgeRow
              label="Status"
              badgeLabel={activity.badge.label}
              badgeVariant={activity.badge.variant}
            />
          )}
          {activity.meta && <DetailRow label="Info" value={activity.meta} />}
        </div>
      </div>

      <DescriptionBlock label="Description" text={activity.description} />
    </>
  );
}

// ── Footer actions per type ─────────────────────────────────────────────────

function getFooter(
  activity: ActivityDetail | null,
  props: ActivityDetailDrawerProps,
) {
  if (!activity) return undefined;

  switch (activity.type) {
    case "meeting": {
      const isCompleted =
        activity.badge?.label === "Completed" ||
        activity.badge?.label === "Cancelled";
      if (isCompleted) return undefined;
      return (
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={props.onReschedule}>
            Reschedule
          </Button>
          <Button onClick={props.onMarkComplete}>Mark Complete</Button>
        </div>
      );
    }
    case "deal":
      return (
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={props.onEditDeal}>
            Edit Deal
          </Button>
          <Button onClick={props.onMoveToNextStage}>Move to Next Stage</Button>
        </div>
      );
    case "task":
      return (
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={props.onEditTask}>
            Edit Task
          </Button>
          <Button onClick={props.onMarkComplete}>Mark Complete</Button>
        </div>
      );
    case "invoice":
      return (
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={props.onDownloadPdf}>
            Download PDF
          </Button>
          <Button onClick={props.onMarkAsPaid}>Mark as Paid</Button>
        </div>
      );
    default:
      return undefined;
  }
}

// ── Main component ──────────────────────────────────────────────────────────

export function ActivityDetailDrawer(props: ActivityDetailDrawerProps) {
  const { open, onClose, activity, customerName } = props;

  const renderContent = () => {
    if (!activity) return null;

    switch (activity.type) {
      case "meeting":
        return (
          <MeetingDetails activity={activity} customerName={customerName} />
        );
      case "deal":
        return <DealDetails activity={activity} />;
      case "task":
        return <TaskDetails activity={activity} />;
      case "invoice":
        return <InvoiceDetails activity={activity} />;
      default:
        return <GenericDetails activity={activity} />;
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={activity?.title || ""}
      footer={getFooter(activity, props)}
    >
      {renderContent()}
    </Drawer>
  );
}
