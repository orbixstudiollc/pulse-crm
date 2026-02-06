"use client";

import { useState, useRef, useEffect } from "react";
import {
  Modal,
  Input,
  Select,
  Textarea,
  Button,
  PhoneIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  NoteIcon,
  UsersThreeIcon,
  XIcon,
  ClockIcon,
} from "@/components/ui";
import { cn } from "@/lib/utils";

// Activity types
type ActivityType = "call" | "meeting" | "task" | "email" | "note";

// Related entity type
interface RelatedEntity {
  id: string;
  name: string;
  type: "customer" | "lead" | "deal";
}

// Mock data for search
const mockEntities: RelatedEntity[] = [
  { id: "c1", name: "MegaCorp", type: "customer" },
  { id: "c2", name: "CloudNine", type: "customer" },
  { id: "l1", name: "TechFlow Inc.", type: "lead" },
  { id: "l2", name: "StartupX", type: "lead" },
  { id: "d1", name: "Enterprise Suite", type: "deal" },
  { id: "d2", name: "Pro Package", type: "deal" },
];

// Activity type config
const activityTypes: {
  id: ActivityType;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { id: "call", label: "Call", icon: PhoneIcon },
  { id: "meeting", label: "Meeting", icon: CalendarBlankIcon },
  { id: "task", label: "Task", icon: CheckCircleIcon },
  { id: "note", label: "Note", icon: NoteIcon },
];

// Duration options
const durationOptions = [
  { label: "15 minutes", value: "15" },
  { label: "30 minutes", value: "30" },
  { label: "45 minutes", value: "45" },
  { label: "1 hour", value: "60" },
  { label: "1.5 hours", value: "90" },
  { label: "2 hours", value: "120" },
];

// Helper to get today's date
const getToday = () => new Date().toISOString().split("T")[0];

interface LogActivityModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (data: {
    type: ActivityType;
    title: string;
    relatedTo: RelatedEntity | null;
    date: string;
    time: string;
    duration: string;
    notes: string;
  }) => void;
  mode?: "create" | "edit";
  initialData?: {
    type: ActivityType;
    title: string;
    relatedTo: RelatedEntity | null;
    date: string;
    time: string;
    duration: string;
    notes: string;
  };
}

export function LogActivityModal({
  open,
  onClose,
  onSubmit,
  mode = "create",
  initialData,
}: LogActivityModalProps) {
  // Initialize state directly from props (use key prop on parent to reset)
  const [activityType, setActivityType] = useState<ActivityType>(
    initialData?.type || "call",
  );
  const [title, setTitle] = useState(initialData?.title || "");
  const [relatedTo, setRelatedTo] = useState<RelatedEntity | null>(
    initialData?.relatedTo || null,
  );
  const [date, setDate] = useState(initialData?.date || getToday());
  const [time, setTime] = useState(initialData?.time || "10:00");
  const [duration, setDuration] = useState(initialData?.duration || "30");
  const [notes, setNotes] = useState(initialData?.notes || "");

  // Related To search state
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Filter entities based on search
  const filteredEntities = mockEntities.filter((entity) =>
    entity.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Close search results when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = () => {
    onSubmit?.({
      type: activityType,
      title,
      relatedTo,
      date,
      time,
      duration,
      notes,
    });
    onClose();
  };

  const getTypeLabel = (type: "customer" | "lead" | "deal") => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <Modal open={open} onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-neutral-800">
        <h2 className="text-xl font-serif text-neutral-950 dark:text-neutral-50">
          {mode === "edit" ? "Edit Activity" : "Log Activity"}
        </h2>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors"
        >
          <XIcon size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
        {/* Activity Type */}
        <div>
          <label className="block text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-2">
            Activity Type
          </label>
          <div className="flex gap-2">
            {activityTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = activityType === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setActivityType(type.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                    isSelected
                      ? "border-neutral-950 dark:border-neutral-50 bg-neutral-950 dark:bg-neutral-50 text-white dark:text-neutral-950"
                      : "border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600",
                  )}
                >
                  <Icon size={18} />
                  {type.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Title */}
        <Input
          label="Title"
          required
          placeholder="e.g., Call with John about proposal"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        {/* Related To */}
        <div ref={searchRef}>
          <label className="block text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-2">
            Related To
          </label>

          {relatedTo ? (
            // Selected entity chip
            <div className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
              <div className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <UsersThreeIcon size={18} className="text-neutral-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {relatedTo.name}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {getTypeLabel(relatedTo.type)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRelatedTo(null)}
                className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <XIcon size={18} className="text-neutral-400" />
              </button>
            </div>
          ) : (
            // Search input
            <div className="relative">
              <Input
                placeholder="Search customers, leads or deals..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowResults(true);
                }}
                onFocus={() => setShowResults(true)}
              />

              {/* Search Results Dropdown */}
              {showResults && searchQuery && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                  {filteredEntities.length > 0 ? (
                    filteredEntities.map((entity) => (
                      <button
                        key={entity.id}
                        type="button"
                        onClick={() => {
                          setRelatedTo(entity);
                          setSearchQuery("");
                          setShowResults(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-left"
                      >
                        <div className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                          <UsersThreeIcon
                            size={18}
                            className="text-neutral-500"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                            {entity.name}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            {getTypeLabel(entity.type)}
                          </p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">
                      No results found
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-2">
              Date
            </label>
            <div className="relative">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="pr-10"
              />
              <CalendarBlankIcon
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-2">
              Time
            </label>
            <div className="relative">
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="pr-10"
              />
              <ClockIcon
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
              />
            </div>
          </div>
        </div>

        {/* Duration */}
        <Select
          label="Duration"
          options={durationOptions}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />

        {/* Notes */}
        <Textarea
          label="Notes"
          placeholder="Add any notes or details..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 p-5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!title}>
          {mode === "edit" ? "Update Activity" : "Save Activity"}
        </Button>
      </div>
    </Modal>
  );
}
