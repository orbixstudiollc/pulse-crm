"use client";

import { useState } from "react";
import { Modal, Button, Select, Textarea, XIcon } from "@/components/ui";
import {
  ThumbsUpIcon,
  ThumbsDownIcon,
  MinusCircleIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface CompleteMeetingModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: (data: {
    sentiment: string;
    duration: string;
    followUp: string;
    notes: string;
  }) => void;
}

export function CompleteMeetingModal({
  open,
  onClose,
  onComplete,
}: CompleteMeetingModalProps) {
  const [sentiment, setSentiment] = useState("positive");
  const [duration, setDuration] = useState("30");
  const [followUp, setFollowUp] = useState("none");
  const [notes, setNotes] = useState("");

  const handleComplete = () => {
    onComplete({ sentiment, duration, followUp, notes });
    onClose();
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
      <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
        <h2 className="text-xl font-serif text-neutral-950 dark:text-neutral-50">
          Complete Meeting
        </h2>
        <button
          onClick={onClose}
          className="p-1 rounded text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <XIcon size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="p-6 space-y-5">
        {/* Sentiment */}
        <div>
          <label className="block text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-3">
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
                    "flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2 transition-all",
                    sentiment === option.value
                      ? option.value === "positive"
                        ? "border-green-400 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400"
                        : option.value === "negative"
                          ? "border-red-400 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                          : "border-neutral-400 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                      : "border-neutral-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500 hover:border-neutral-300 dark:hover:border-neutral-700",
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
            options={[
              { label: "15 mins", value: "15" },
              { label: "30 mins", value: "30" },
              { label: "45 mins", value: "45" },
              { label: "1 hour", value: "60" },
              { label: "1.5 hours", value: "90" },
              { label: "2 hours", value: "120" },
            ]}
          />
          <Select
            label="Follow Up"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            options={[
              { label: "No follow-up", value: "none" },
              { label: "Send email", value: "email" },
              { label: "Schedule meeting", value: "meeting" },
              { label: "Create task", value: "task" },
            ]}
          />
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
      <div className="flex justify-end gap-3 p-6 border-t border-neutral-200 dark:border-neutral-800">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleComplete}>Complete Meeting</Button>
      </div>
    </Modal>
  );
}
