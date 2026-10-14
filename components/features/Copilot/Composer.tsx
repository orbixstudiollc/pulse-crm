"use client";

import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { SparkleIcon, ArrowUpIcon, ClockIcon } from "@/components/ui";
import { createTaskFromPrompt } from "@/lib/actions/copilot-tasks";
import { getCopilotSettings } from "@/lib/actions/copilot-settings";
import { BTN_GHOST, BTN_PRIMARY, FIELD, LABEL } from "./styles";

type TaskSchedule = "daily" | "weekly" | "monthly";

const SCHEDULES: Array<{ value: TaskSchedule; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const TITLE_PREFILL_LENGTH = 60;
/** The server's limit for one chat message (chatRequestSchema). */
export const MESSAGE_MAX_LENGTH = 8000;
const GUEST_TASK_NOTICE =
  "Guest workspaces can schedule one task; it runs on the next daily cycle while this workspace exists";

function formatUtcDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function SchedulePopover({ prompt, onClose }: { prompt: string; onClose(): void }) {
  const [title, setTitle] = useState(() => prompt.trim().slice(0, TITLE_PREFILL_LENGTH));
  const [schedule, setSchedule] = useState<TaskSchedule>("daily");
  const [isGuest, setIsGuest] = useState(false);
  const [saving, setSaving] = useState(false);
  const titleId = useId();
  const scheduleId = useId();

  // The session's guest flag comes from the server; until it arrives the non-guest wording is shown.
  useEffect(() => {
    let cancelled = false;
    getCopilotSettings()
      .then((settings) => {
        if (!cancelled) setIsGuest(settings.usage.isGuest);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const result = await createTaskFromPrompt({ title, prompt, schedule });
      if (result.ok) {
        toast.success(
          isGuest
            ? GUEST_TASK_NOTICE
            : `Runs on the next daily run after ${formatUtcDate(result.nextRunAt)} (UTC)`,
        );
        onClose();
      } else if (result.error === "task_cap") {
        toast.error(isGuest ? GUEST_TASK_NOTICE : "You have reached the limit of scheduled tasks. Delete one to add another.");
      } else {
        toast.error("Give the task a title (up to 120 characters) and a prompt (up to 4000 characters).");
      }
    } catch {
      toast.error("Could not create the task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Schedule this prompt"
      data-clay-box className="absolute bottom-full right-0 z-10 mb-2 w-72 rounded-lg border border-line bg-surface p-4 shadow-card"
    >
      <label htmlFor={titleId} className={LABEL}>
        Title
      </label>
      <input
        id={titleId}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        className={`${FIELD} h-8`}
      />
      <label htmlFor={scheduleId} className={`${LABEL} mt-3`}>
        Repeat
      </label>
      <select
        id={scheduleId}
        value={schedule}
        onChange={(e) => setSchedule(e.target.value as TaskSchedule)}
        className={`${FIELD} h-8`}
      >
        {SCHEDULES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {isGuest && <p className="mt-3 text-[13px] leading-5 text-fg-muted">{GUEST_TASK_NOTICE}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={BTN_GHOST}>
          Cancel
        </button>
        <button type="button" onClick={handleCreate} disabled={saving || !title.trim()} className={BTN_PRIMARY}>
          Create
        </button>
      </div>
    </div>
  );
}

export function Composer({
  value,
  onChange,
  onSend,
  isLoading,
  blockedReason,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  /** Why sending is paused (e.g. approval cards wait for an answer); shown as a hint. */
  blockedReason?: string;
}) {
  const [scheduling, setScheduling] = useState(false);
  const clockRef = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const canSend = value.trim() !== "" && !isLoading && !blockedReason;

  useEffect(() => {
    if (!scheduling) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!clockRef.current?.contains(e.target as Node)) setScheduling(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setScheduling(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [scheduling]);

  return (
    <div data-clay-box className="mx-auto w-full max-w-3xl rounded-lg border border-line bg-surface shadow-card transition-colors focus-within:border-accent">
      <div className="flex items-start gap-2.5 px-4 pt-3.5">
        <SparkleIcon size={16} weight="fill" className="mt-0.5 shrink-0 text-accent" />
        <textarea
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          placeholder="Ask Pulse AI or type / to see prompts..."
          aria-label="Message Pulse Copilot"
          aria-describedby={blockedReason ? hintId : undefined}
          maxLength={MESSAGE_MAX_LENGTH}
          className="flex-1 min-w-0 pb-1 text-[13px] leading-5 text-fg placeholder:text-fg-muted bg-transparent outline-none resize-none min-h-[40px]"
          rows={1}
          disabled={isLoading}
        />
      </div>
      <div className="flex items-center justify-end gap-2 px-3 pb-3">
        {blockedReason && (
          <p id={hintId} className="mr-auto pl-1 text-[13px] text-fg-muted">
            {blockedReason}
          </p>
        )}
        {value.length > 0 && (
          <span className="text-[12px] tabular-nums text-fg-muted">
            {value.length}/{MESSAGE_MAX_LENGTH}
          </span>
        )}
        <div ref={clockRef} className="relative">
          <button
            type="button"
            onClick={() => setScheduling((open) => !open)}
            disabled={!value.trim()}
            aria-label="Schedule this prompt"
            aria-expanded={scheduling}
            className="flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-subtle hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <ClockIcon size={16} />
          </button>
          {scheduling && <SchedulePopover prompt={value} onClose={() => setScheduling(false)} />}
        </div>
        <button
          onClick={onSend}
          disabled={!canSend}
          aria-label="Send message"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-on-inverse transition-colors hover:bg-accent-strong disabled:opacity-40 disabled:hover:bg-accent"
        >
          <ArrowUpIcon size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}
