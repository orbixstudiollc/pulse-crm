"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  PlusIcon,
  PencilSimpleIcon,
  CheckIcon,
  XIcon,
  ClockIcon,
  TrashIcon,
} from "@/components/ui";
import { Page, PageHeader, Section, EmptyState } from "@/components/dashboard";
import type { Tables } from "@/types/database";
import { createCopilotTask, updateCopilotTask, deleteCopilotTask } from "@/lib/actions/copilot";
import { BTN_PRIMARY, BTN_OUTLINE, FIELD, LABEL } from "./styles";

type CopilotTask = Tables<"copilot_tasks">;

export function TasksView({ tasks, setTasks }: { tasks: CopilotTask[]; setTasks: React.Dispatch<React.SetStateAction<CopilotTask[]>> }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    prompt: "",
    schedule: "daily" as CopilotTask["schedule"],
  });

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.prompt.trim()) {
      toast.error("Title and prompt are required");
      return;
    }

    if (editingId) {
      const result = await updateCopilotTask(editingId, formData);
      if (result.success) {
        setTasks(prev => prev.map(t => t.id === editingId ? { ...t, ...formData } : t));
        toast.success("Task updated");
      }
    } else {
      const result = await createCopilotTask(formData);
      if (result.data) {
        setTasks(prev => [result.data!, ...prev]);
        toast.success("Task created");
      }
    }
    setShowForm(false);
    setEditingId(null);
    setFormData({ title: "", prompt: "", schedule: "daily" });
  };

  const handleToggle = async (task: CopilotTask) => {
    const result = await updateCopilotTask(task.id, { is_active: !task.is_active });
    if (result.success) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_active: !t.is_active } : t));
    }
  };

  const handleDelete = async (id: string) => {
    await deleteCopilotTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
    toast.success("Task deleted");
  };

  const scheduleLabels: Record<string, string> = {
    daily: "Every day",
    weekly: "Every week",
    monthly: "Every month",
    custom: "Custom schedule",
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <Page>
        <PageHeader
          icon={<ClockIcon size={18} />}
          title="Tasks"
          description="Manage recurring prompts that Copilot can execute on a schedule."
        >
          {!showForm && (
            <button onClick={() => setShowForm(true)} className={BTN_PRIMARY}>
              <PlusIcon size={16} weight="bold" />
              Create new task
            </button>
          )}
        </PageHeader>

        {!showForm ? (
          tasks.length === 0 ? (
            <div className="border-t border-divider">
              <EmptyState
                icon={<ClockIcon size={24} />}
                title="No tasks yet"
                description="Create recurring prompts to automate your workflow."
              />
            </div>
          ) : (
            <div className="border-t border-divider">
              {tasks.map(task => (
                <div key={task.id} className="group flex items-start justify-between gap-3 px-8 py-3 border-b border-divider transition-colors hover:bg-subtle max-sm:px-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-[14px] font-medium text-fg">{task.title}</h4>
                      <span className={cn(
                        "text-[12px] px-2 py-0.5 rounded-full font-medium",
                        task.is_active
                          ? "bg-success-surface text-success"
                          : "bg-muted text-fg-secondary"
                      )}>
                        {task.is_active ? "Active" : "Paused"}
                      </span>
                    </div>
                    <p className="text-[13px] text-fg-secondary line-clamp-1 mb-1">{task.prompt}</p>
                    <div className="flex items-center gap-3 text-[12px] text-fg-muted">
                      <span className="flex items-center gap-1">
                        <ClockIcon size={12} />
                        {scheduleLabels[task.schedule]}
                      </span>
                      {task.run_count > 0 && <span>Ran {task.run_count} times</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3">
                    <button
                      onClick={() => handleToggle(task)}
                      className="p-1.5 rounded hover:bg-muted transition-colors"
                      title={task.is_active ? "Pause" : "Activate"}
                    >
                      {task.is_active ? (
                        <XIcon size={14} className="text-fg-muted" />
                      ) : (
                        <CheckIcon size={14} className="text-success" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setFormData({ title: task.title, prompt: task.prompt, schedule: task.schedule });
                        setEditingId(task.id);
                        setShowForm(true);
                      }}
                      className="p-1.5 rounded hover:bg-muted transition-colors"
                    >
                      <PencilSimpleIcon size={14} className="text-fg-muted" />
                    </button>
                    <button onClick={() => handleDelete(task.id)} className="p-1.5 rounded hover:bg-danger-surface transition-colors">
                      <TrashIcon size={14} className="text-danger" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Task Form */
          <Section title={editingId ? "Edit Task" : "Create Task"}>
            <div className="max-w-[560px] space-y-4">
              <div>
                <label className={LABEL}>Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Daily Pipeline Summary"
                  className={cn(FIELD, "h-8")}
                />
              </div>

              <div>
                <label className={LABEL}>Prompt</label>
                <textarea
                  value={formData.prompt}
                  onChange={e => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
                  placeholder="What should Copilot do? e.g. Summarize my pipeline and highlight deals at risk..."
                  rows={4}
                  className={cn(FIELD, "py-2 resize-none")}
                />
              </div>

              <div>
                <label className={LABEL}>Schedule</label>
                <select
                  value={formData.schedule}
                  onChange={e => setFormData(prev => ({ ...prev, schedule: e.target.value as CopilotTask["schedule"] }))}
                  className={cn(FIELD, "h-8")}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button onClick={handleSave} className={BTN_PRIMARY}>
                  {editingId ? "Update" : "Create"}
                </button>
                <button
                  onClick={() => { setShowForm(false); setEditingId(null); setFormData({ title: "", prompt: "", schedule: "daily" }); }}
                  className={BTN_OUTLINE}
                >
                  Cancel
                </button>
              </div>
            </div>
          </Section>
        )}
      </Page>
    </div>
  );
}
