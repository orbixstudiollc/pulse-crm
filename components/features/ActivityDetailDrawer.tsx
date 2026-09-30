"use client";

import { Drawer, Badge, Button, CalendarBlankIcon, type BadgeVariant } from "@/components/ui";

interface ActivityDetail {
  id: string;
  type: "email" | "call" | "deal" | "meeting" | "note" | "task" | "invoice";
  title: string;
  description: string;
  badge?: {
    label: string;
    variant: BadgeVariant;
  };
  meta?: string;
  /** Event date (YYYY-MM-DD); enables the Add to Calendar actions. */
  date?: string | null;
  /** Event start time (HH:MM); omitted means an all-day event. */
  time?: string | null;
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
      <p className="text-sm text-fg-secondary">{label}</p>
      <p className="text-sm font-medium text-fg">
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
      <p className="text-sm text-fg-secondary">{label}</p>
      <Badge variant={badgeVariant}>{badgeLabel}</Badge>
    </div>
  );
}

// ── Section header ──────────────────────────────────────────────────────────
function SectionHeader({ children }: { children: string }) {
  return (
    <p className="text-xs font-medium text-fg-secondary mb-4">
      {children}
    </p>
  );
}

// ── Description block ───────────────────────────────────────────────────────
function DescriptionBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="mb-6">
      <SectionHeader>{label}</SectionHeader>
      <div className="rounded-md bg-subtle p-4">
        <p className="text-sm text-fg-secondary leading-relaxed">
          {text}
        </p>
      </div>
    </div>
  );
}

// ── Calendar export ─────────────────────────────────────────────────────────

const DEFAULT_EVENT_MINUTES = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

type EventWindow = { start: Date; end: Date; allDay: boolean };

// Resolve the event window from date/time, falling back to a "YYYY-MM-DD at HH:MM" meta.
function getEventWindow(activity: ActivityDetail): EventWindow | null {
  let date = activity.date ?? null;
  let time = activity.time ?? null;
  if (!date && activity.meta) {
    const match = /^(\d{4}-\d{2}-\d{2})(?: at (\d{1,2}:\d{2}))?/.exec(activity.meta);
    if (match) {
      date = match[1];
      time = match[2] ?? null;
    }
  }
  const day = date?.slice(0, 10);
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;

  if (time) {
    const [h, m] = time.split(":");
    const start = new Date(`${day}T${h.padStart(2, "0")}:${(m ?? "00").slice(0, 2)}:00`);
    if (isNaN(start.getTime())) return null;
    return {
      start,
      end: new Date(start.getTime() + DEFAULT_EVENT_MINUTES * 60 * 1000),
      allDay: false,
    };
  }

  const start = new Date(`${day}T00:00:00Z`);
  if (isNaN(start.getTime())) return null;
  return { start, end: new Date(start.getTime() + DAY_MS), allDay: true };
}

// UTC basic format: 20260930T100000Z, or 20260930 for all-day events.
function formatCalendarDate(d: Date, allDay: boolean): string {
  const iso = d.toISOString();
  return allDay
    ? iso.slice(0, 10).replace(/-/g, "")
    : iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function getGoogleCalendarUrl(activity: ActivityDetail, win: EventWindow): string {
  const params = new URLSearchParams({
    text: activity.title,
    dates: `${formatCalendarDate(win.start, win.allDay)}/${formatCalendarDate(win.end, win.allDay)}`,
    details: activity.description,
  });
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&${params.toString()}`;
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function downloadIcs(activity: ActivityDetail, win: EventWindow) {
  const dateProp = win.allDay ? ";VALUE=DATE" : "";
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pulse CRM//EN",
    "BEGIN:VEVENT",
    `UID:${activity.id}@pulse-crm`,
    `DTSTAMP:${formatCalendarDate(new Date(), false)}`,
    `DTSTART${dateProp}:${formatCalendarDate(win.start, win.allDay)}`,
    `DTEND${dateProp}:${formatCalendarDate(win.end, win.allDay)}`,
    `SUMMARY:${escapeIcsText(activity.title)}`,
    `DESCRIPTION:${escapeIcsText(activity.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const url = URL.createObjectURL(
    new Blob([ics], { type: "text/calendar;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${activity.title.replace(/[^\w-]+/g, "_") || "event"}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
  const eventWindow = getEventWindow(activity);

  return (
    <>
      <div className="mb-6">
        <SectionHeader>Details</SectionHeader>
        <div className="divide-y divide-row">
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

      {!isCompleted && eventWindow && (
        <div>
          <SectionHeader>Add to Calendar</SectionHeader>
          <div className="flex flex-wrap gap-2">
            <a
              href={getGoogleCalendarUrl(activity, eventWindow)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-2 px-3 rounded-md border border-line bg-surface text-sm font-medium text-fg hover:bg-muted transition-colors"
            >
              <CalendarBlankIcon size={16} />
              Google Calendar
            </a>
            <button
              type="button"
              onClick={() => downloadIcs(activity, eventWindow)}
              className="inline-flex h-8 items-center gap-2 px-3 rounded-md border border-line bg-surface text-sm font-medium text-fg hover:bg-muted transition-colors"
            >
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
        <div className="divide-y divide-row">
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
        <div className="divide-y divide-row">
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
        <div className="divide-y divide-row">
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
        <div className="divide-y divide-row">
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
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={props.onReschedule}>
            Reschedule
          </Button>
          <Button onClick={props.onMarkComplete}>Mark Complete</Button>
        </div>
      );
    }
    case "deal":
      return (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={props.onEditDeal}>
            Edit Deal
          </Button>
          <Button onClick={props.onMoveToNextStage}>Move to Next Stage</Button>
        </div>
      );
    case "task":
      return (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={props.onEditTask}>
            Edit Task
          </Button>
          <Button onClick={props.onMarkComplete}>Mark Complete</Button>
        </div>
      );
    case "invoice":
      return (
        <div className="flex justify-end gap-2">
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
