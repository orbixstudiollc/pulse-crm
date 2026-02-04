"use client";

import { useState } from "react";
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

interface ScheduleMeetingModalProps {
  open: boolean;
  onClose: () => void;
  customerName: string;
}

export function ScheduleMeetingModal({
  open,
  onClose,
  customerName,
}: ScheduleMeetingModalProps) {
  const [title, setTitle] = useState(`Meeting with ${customerName}`);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("30");
  const [attendees, setAttendees] = useState<string[]>([customerName, "You"]);
  const [notes, setNotes] = useState("");
  const [addToCalendar, setAddToCalendar] = useState(true);

  const handleSchedule = () => {
    // Handle scheduling logic
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
        <h2 className="text-lg font-serif text-neutral-950 dark:text-neutral-50">
          Schedule Meeting
        </h2>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <XIcon size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="p-6 space-y-5">
        {/* Title */}
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Meeting title"
        />

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-4">
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
          options={[
            { label: "15 mins", value: "15" },
            { label: "30 mins", value: "30" },
            { label: "45 mins", value: "45" },
            { label: "1 hour", value: "60" },
            { label: "1.5 hours", value: "90" },
            { label: "2 hours", value: "120" },
          ]}
        />

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
      <div className="flex justify-end gap-3 p-6 border-t border-neutral-200 dark:border-neutral-800">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSchedule}>Schedule Meeting</Button>
      </div>
    </Modal>
  );
}
