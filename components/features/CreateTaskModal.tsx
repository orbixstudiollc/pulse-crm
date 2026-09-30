"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Modal,
  Button,
  Input,
  Select,
  Textarea,
  Checkbox,
  XIcon,
} from "@/components/ui";
import { createActivity } from "@/lib/actions/activities";
import { getOrgMembers } from "@/lib/actions/team";
import { type RecordLink, recordLinkToRelated } from "./ScheduleMeetingModal";

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  customerName: string;
  link?: RecordLink;
  onSaved?: () => void;
}

export function CreateTaskModal({
  open,
  onClose,
  customerName,
  link,
  onSaved,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState(`Follow up with ${customerName}`);
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [remind, setRemind] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Load org members when opened; the current user is first and the default.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getOrgMembers()
      .then((list) => {
        if (cancelled) return;
        setMembers(list);
        setAssignedTo((current) => current || list[0]?.id || "");
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Failed to load team members");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleCreate = () => {
    if (!title.trim()) {
      toast.error("Task title is required");
      return;
    }
    startTransition(async () => {
      const res = await createActivity({
        type: "task",
        status: "pending",
        title: title.trim(),
        description: description.trim() || null,
        date: dueDate || null,
        assignee: assignedTo || null,
        ...recordLinkToRelated(link, customerName),
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Task created");
      onSaved?.();
      onClose();
    });
  };

  return (
    <Modal open={open} onClose={onClose}>
      {/* Header */}
      <div className="flex h-12 items-center justify-between px-4 border-b border-divider">
        <h2 className="text-heading-md text-fg">
          Create Task
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
        {/* Task Title */}
        <Input
          label="Task Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter task title"
        />

        {/* Description */}
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add details about this task..."
          rows={3}
        />

        {/* Due Date & Priority */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <Select
            label="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            {[
              { label: "Low", value: "low" },
              { label: "Medium", value: "medium" },
              { label: "High", value: "high" },
              { label: "Urgent", value: "urgent" },
            ].map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Assigned To */}
        <Select
          label="Assigned To"
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>

        {/* Reminder */}
        <Checkbox
          label="Remind me 1 day before"
          checked={remind}
          onChange={(e) => setRemind(e.target.checked)}
        />
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-divider">
        <Button variant="ghost" className="shrink-0" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleCreate} disabled={isPending}>
          {isPending ? "Creating..." : "Create Task"}
        </Button>
      </div>
    </Modal>
  );
}
