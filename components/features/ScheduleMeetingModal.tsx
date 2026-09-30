"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Modal,
  Button,
  Input,
  Select,
  Textarea,
  Checkbox,
  TagInput,
  XIcon,
  ClockIcon,
  CalendarBlankIcon,
} from "@/components/ui";
import { createCalendarEvent } from "@/lib/actions/calendar";

/** The record a meeting/task/activity is attached to. */
export interface RecordLink {
  leadId?: string;
  customerId?: string;
  dealId?: string;
}

/** Maps a RecordLink onto the related_type/related_id/related_name columns. */
export function recordLinkToRelated(link: RecordLink | undefined, name: string) {
  if (link?.dealId) return { related_type: "deal", related_id: link.dealId, related_name: name };
  if (link?.customerId) return { related_type: "customer", related_id: link.customerId, related_name: name };
  if (link?.leadId) return { related_type: "lead", related_id: link.leadId, related_name: name };
  return {};
}

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

interface ScheduleMeetingModalProps {
  open: boolean;
  onClose: () => void;
  customerName: string;
  link?: RecordLink;
  onSaved?: () => void;
}

export function ScheduleMeetingModal({
  open,
  onClose,
  customerName,
  link,
  onSaved,
}: ScheduleMeetingModalProps) {
  const [title, setTitle] = useState(`Meeting with ${customerName}`);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("30");
  const [attendees, setAttendees] = useState<string[]>([customerName, "You"]);
  const [notes, setNotes] = useState("");
  const [addToCalendar, setAddToCalendar] = useState(true);

  const [isPending, startTransition] = useTransition();

  const handleSchedule = () => {
    if (!title.trim() || !date) {
      toast.error("Title and date are required");
      return;
    }
    const description = [
      notes.trim(),
      attendees.length ? `Attendees: ${attendees.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    startTransition(async () => {
      const res = await createCalendarEvent({
        title: title.trim(),
        type: "meeting",
        status: "scheduled",
        date,
        start_time: time || null,
        end_time: time ? addMinutes(time, Number(duration)) : null,
        description: description || null,
        ...recordLinkToRelated(link, customerName),
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Meeting scheduled");
      onSaved?.();
      onClose();
    });
  };

  return (
    <Modal open={open} onClose={onClose}>
      {/* Header */}
      <div className="flex h-12 items-center justify-between px-4 border-b border-divider">
        <h2 className="text-heading-md text-fg">
          Schedule Meeting
        </h2>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary hover:bg-muted hover:text-fg transition-colors"
        >
          <XIcon size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Title */}
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Meeting title"
        />

        {/* Date & Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            leftIcon={<CalendarBlankIcon size={16} />}
          />
          <Input
            label="Time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            leftIcon={<ClockIcon size={16} />}
          />
        </div>

        {/* Duration */}
        <Select
          label="Duration"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        >
          {[
            { label: "15 mins", value: "15" },
            { label: "30 mins", value: "30" },
            { label: "45 mins", value: "45" },
            { label: "1 hour", value: "60" },
            { label: "1.5 hours", value: "90" },
            { label: "2 hours", value: "120" },
          ].map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>

        {/* Attendees */}
        <TagInput
          label="Attendees"
          tags={attendees}
          onChange={setAttendees}
          placeholder="Add attendee..."
        />

        {/* Notes */}
        <Textarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add meeting notes or agenda..."
          rows={3}
        />

        {/* Add to calendar */}
        <Checkbox
          label="Add to calendar"
          checked={addToCalendar}
          onChange={(e) => setAddToCalendar(e.target.checked)}
        />
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-divider">
        <Button variant="ghost" className="shrink-0" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSchedule} disabled={isPending}>
          {isPending ? "Scheduling..." : "Schedule Meeting"}
        </Button>
      </div>
    </Modal>
  );
}
