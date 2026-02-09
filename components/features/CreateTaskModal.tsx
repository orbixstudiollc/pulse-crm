"use client";

import { useState } from "react";
import {
  Modal,
  Button,
  Input,
  Select,
  Textarea,
  Checkbox,
  XIcon,
} from "@/components/ui";

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  customerName: string;
}

export function CreateTaskModal({
  open,
  onClose,
  customerName,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState(`Follow up with ${customerName}`);
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignedTo, setAssignedTo] = useState("me");
  const [remind, setRemind] = useState(true);

  const handleCreate = () => {
    // Handle task creation logic
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
        <h2 className="text-xl font-serif text-neutral-950 dark:text-neutral-50">
          Create Task
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
            options={[
              { label: "Low", value: "low" },
              { label: "Medium", value: "medium" },
              { label: "High", value: "high" },
              { label: "Urgent", value: "urgent" },
            ]}
          />
        </div>

        {/* Assigned To */}
        <Select
          label="Assigned To"
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          options={[
            { label: "Me", value: "me" },
            { label: "Sarah Kim", value: "sarah" },
            { label: "Mike Johnson", value: "mike" },
            { label: "Jennifer Kim", value: "jennifer" },
          ]}
        />

        {/* Reminder */}
        <Checkbox
          label="Remind me 1 day before"
          checked={remind}
          onChange={(e) => setRemind(e.target.checked)}
        />
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 p-6 border-t border-neutral-200 dark:border-neutral-800">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleCreate}>Create Task</Button>
      </div>
    </Modal>
  );
}
