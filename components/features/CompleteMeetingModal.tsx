"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Modal, Button, Select, Textarea, XIcon } from "@/components/ui";
import {
  ThumbsUpIcon,
  ThumbsDownIcon,
  MinusCircleIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { createActivity, updateActivity } from "@/lib/actions/activities";
import { type RecordLink, recordLinkToRelated } from "./ScheduleMeetingModal";

const DURATION_LABELS: Record<string, string> = {
  "15": "15 mins",
  "30": "30 mins",
  "45": "45 mins",
  "60": "1 hour",
  "90": "1.5 hours",
  "120": "2 hours",
};

const FOLLOW_UP_LABELS: Record<string, string> = {
  none: "No follow-up",
  email: "Send email",
  meeting: "Schedule meeting",
  task: "Create task",
};

interface CompleteMeetingModalProps {
  open: boolean;
  onClose: () => void;
  onComplete?: (data: {
    sentiment: string;
    duration: string;
    followUp: string;
    notes: string;
  }) => void;
  /** `activities` row to mark completed. Without it, a completed meeting is logged against `link`. */
  activityId?: string;
  link?: RecordLink;
  customerName?: string;
  onSaved?: () => void;
}

export function CompleteMeetingModal({
  open,
  onClose,
  onComplete,
  activityId,
  link,
  customerName = "",
  onSaved,
}: CompleteMeetingModalProps) {
  const [sentiment, setSentiment] = useState("positive");
  const [duration, setDuration] = useState("30");
  const [followUp, setFollowUp] = useState("none");
  const [notes, setNotes] = useState("");

  const [isPending, startTransition] = useTransition();

  const handleComplete = () => {
    const data = { sentiment, duration, followUp, notes };
    if (!activityId && !link) {
      onComplete?.(data);
      onClose();
      return;
    }
    const description = [
      `Outcome: ${sentiment.charAt(0).toUpperCase() + sentiment.slice(1)} · Duration: ${DURATION_LABELS[duration] ?? duration} · Follow-up: ${FOLLOW_UP_LABELS[followUp] ?? followUp}`,
      notes.trim(),
    ]
      .filter(Boolean)
      .join("\n\n");
    const related = recordLinkToRelated(link, customerName);
    startTransition(async () => {
      const res = activityId
        ? await updateActivity(activityId, { status: "completed", description, ...related })
        : await createActivity({
            type: "meeting",
            status: "completed",
            title: customerName ? `Meeting with ${customerName}` : "Meeting",
            description,
            date: new Date().toISOString().split("T")[0],
            ...related,
          });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Meeting completed");
      onComplete?.(data);
      onSaved?.();
      onClose();
    });
  };

  const sentimentOptions = [
    {
      value: "positive",
      label: "Positive",
      icon: ThumbsUpIcon,
    },
    {
      value: "neutral",
      label: "Neutral",
      icon: MinusCircleIcon,
    },
    {
      value: "negative",
      label: "Negative",
      icon: ThumbsDownIcon,
    },
  ];

  return (
    <Modal open={open} onClose={onClose}>
      {/* Header */}
      <div className="flex h-12 items-center justify-between px-4 border-b border-divider">
        <h2 className="text-heading-md text-fg">
          Complete Meeting
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
        {/* Sentiment */}
        <div>
          <label className="block text-sm font-medium text-fg mb-3">
            How did it go?
          </label>
          <div className="grid grid-cols-3 gap-3">
            {sentimentOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  onClick={() => setSentiment(option.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 py-4 px-3 rounded-lg border transition-colors",
                    sentiment === option.value
                      ? option.value === "positive"
                        ? "border-success bg-success-surface text-success"
                        : option.value === "negative"
                          ? "border-danger bg-danger-surface text-danger"
                          : "border-fg-muted bg-subtle text-fg-secondary"
                      : "border-line text-fg-secondary hover:border-fg-muted",
                  )}
                >
                  <Icon size={24} />
                  <span className="text-sm font-medium">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Duration & Follow Up */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <Select
            label="Follow Up"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
          >
            {[
              { label: "No follow-up", value: "none" },
              { label: "Send email", value: "email" },
              { label: "Schedule meeting", value: "meeting" },
              { label: "Create task", value: "task" },
            ].map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Notes */}
        <Textarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add meeting notes or agenda..."
          rows={4}
        />
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-divider">
        <Button variant="ghost" className="shrink-0" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleComplete} disabled={isPending}>
          {isPending ? "Saving..." : "Complete Meeting"}
        </Button>
      </div>
    </Modal>
  );
}
