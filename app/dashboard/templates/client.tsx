"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Button,
  Badge,
  Modal,
  Input,
  Select,
  Textarea,
  ActionMenu,
  PlusIcon,
  EyeIcon,
  PencilSimpleIcon,
  TrashIcon,
  EnvelopeIcon,
  XIcon,
} from "@/components/ui";
import {
  PageHeader,
  StatCard,
  TableHeader,
  TableFooter,
  EmptyState,
} from "@/components/dashboard";
import {
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
} from "@/lib/actions/email-templates";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface TemplateRecord {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  merge_fields: string[];
  usage_count: number;
  created_at: string;
  [key: string]: unknown;
}

// ── Config ───────────────────────────────────────────────────────────────────

const categoryConfig: Record<string, string> = {
  general: "General",
  cold_outreach: "Cold Outreach",
  follow_up: "Follow-Up",
  nurture: "Nurture",
  re_engagement: "Re-engagement",
  meeting: "Meeting",
};

const categoryTabs = [
  { label: "All", value: "all" },
  { label: "Cold Outreach", value: "cold_outreach" },
  { label: "Follow-Up", value: "follow_up" },
  { label: "Nurture", value: "nurture" },
  { label: "Re-engagement", value: "re_engagement" },
  { label: "Meeting", value: "meeting" },
  { label: "General", value: "general" },
];

const categoryOptions = [
  { label: "General", value: "general" },
  { label: "Cold Outreach", value: "cold_outreach" },
  { label: "Follow-Up", value: "follow_up" },
  { label: "Nurture", value: "nurture" },
  { label: "Re-engagement", value: "re_engagement" },
  { label: "Meeting", value: "meeting" },
];

const mergeFieldOptions = [
  "{{firstName}}",
  "{{lastName}}",
  "{{company}}",
  "{{industry}}",
  "{{email}}",
  "{{phone}}",
  "{{website}}",
];

// ── Component ────────────────────────────────────────────────────────────────

export function TemplatesPageClient({
  initialTemplates,
}: {
  initialTemplates: TemplateRecord[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateRecord | null>(
    null
  );
  const [previewTemplate, setPreviewTemplate] =
    useState<TemplateRecord | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState("10");

  // Form state
  const [formName, setFormName] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formCategory, setFormCategory] = useState("general");

  const templates = initialTemplates;

  const filteredTemplates =
    activeTab === "all"
      ? templates
      : templates.filter((t) => t.category === activeTab);

  const perPage = parseInt(rowsPerPage);
  const totalPages = Math.ceil(filteredTemplates.length / perPage);
  const startIndex = (currentPage - 1) * perPage;
  const paginatedTemplates = filteredTemplates.slice(
    startIndex,
    startIndex + perPage
  );
  const displayStart = startIndex + 1;
  const displayEnd = Math.min(startIndex + perPage, filteredTemplates.length);

  const totalTemplates = templates.length;
  const totalUsage = templates.reduce((sum, t) => sum + (t.usage_count || 0), 0);

  const openCreate = () => {
    setEditingTemplate(null);
    setFormName("");
    setFormSubject("");
    setFormBody("");
    setFormCategory("general");
    setShowModal(true);
  };

  const openEdit = (template: TemplateRecord) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormSubject(template.subject);
    setFormBody(template.body);
    setFormCategory(template.category);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formName.trim() || !formSubject.trim() || !formBody.trim()) {
      toast.error("Name, subject, and body are required");
      return;
    }

    // Detect merge fields used in body/subject
    const detectedFields = mergeFieldOptions.filter(
      (f) => formBody.includes(f) || formSubject.includes(f)
    );

    startTransition(async () => {
      if (editingTemplate) {
        const result = await updateEmailTemplate(editingTemplate.id, {
          name: formName.trim(),
          subject: formSubject.trim(),
          body: formBody.trim(),
          category: formCategory,
          merge_fields: detectedFields,
        });
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Template updated");
          setShowModal(false);
          router.refresh();
        }
      } else {
        const result = await createEmailTemplate({
          name: formName.trim(),
          subject: formSubject.trim(),
          body: formBody.trim(),
          category: formCategory,
          merge_fields: detectedFields,
        });
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Template created");
          setShowModal(false);
          router.refresh();
        }
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteEmailTemplate(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Template deleted");
        router.refresh();
      }
    });
  };

  const insertMergeField = (field: string) => {
    setFormBody((prev) => prev + field);
  };

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 space-y-4">
      {/* Header */}
      <PageHeader title="Email Templates">
        <Button
          leftIcon={<PlusIcon size={20} weight="bold" />}
          onClick={openCreate}
        >
          Create Template
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="Total Templates"
          value={totalTemplates.toString()}
          icon={
            <EnvelopeIcon
              size={24}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
        <StatCard
          label="Total Usage"
          value={totalUsage.toString()}
          icon={
            <EyeIcon
              size={24}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-1.5">
        {categoryTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setActiveTab(tab.value);
              setCurrentPage(1);
            }}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded whitespace-nowrap transition-colors",
              activeTab === tab.value
                ? "bg-neutral-950 dark:bg-white text-white dark:text-neutral-950"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
        <TableHeader
          title="All Templates"
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(value) => {
            setRowsPerPage(value);
            setCurrentPage(1);
          }}
        />

        {filteredTemplates.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-[0.5px] border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
                    <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3">
                      Name
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                      Subject
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                      Category
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                      Merge Fields
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                      Used
                    </th>
                    <th className="text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 px-3 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTemplates.map((template) => (
                    <tr
                      key={template.id}
                      className="border-b-[0.5px] border-neutral-200 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                          {template.name}
                        </p>
                      </td>
                      <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-1 max-w-[250px]">
                          {template.subject}
                        </p>
                      </td>
                      <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">
                          {categoryConfig[template.category] ||
                            template.category}
                        </span>
                      </td>
                      <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        <div className="flex flex-wrap gap-1">
                          {(template.merge_fields || [])
                            .slice(0, 3)
                            .map((field) => (
                              <span
                                key={field}
                                className="inline-flex px-1.5 py-0.5 text-[10px] font-mono rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                              >
                                {field}
                              </span>
                            ))}
                          {(template.merge_fields || []).length > 3 && (
                            <span className="text-[10px] text-neutral-400">
                              +{template.merge_fields.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        <span className="text-sm font-medium font-serif text-neutral-950 dark:text-neutral-50">
                          {template.usage_count || 0}
                        </span>
                      </td>
                      <td className="px-3 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        <div className="flex justify-center">
                          <ActionMenu
                            items={[
                              {
                                label: "Preview",
                                icon: <EyeIcon size={18} />,
                                onClick: () => setPreviewTemplate(template),
                              },
                              {
                                label: "Edit",
                                icon: <PencilSimpleIcon size={18} />,
                                onClick: () => openEdit(template),
                              },
                              {
                                label: "Delete",
                                icon: <TrashIcon size={18} />,
                                onClick: () => handleDelete(template.id),
                                variant: "danger",
                              },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <TableFooter
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredTemplates.length}
              startIndex={displayStart}
              endIndex={displayEnd}
              onPageChange={setCurrentPage}
              itemLabel="templates"
            />
          </>
        ) : (
          <EmptyState
            icon={<EnvelopeIcon size={24} />}
            title={
              activeTab !== "all"
                ? "No templates in this category"
                : "No email templates yet"
            }
            description="Create reusable email templates with merge fields for your outreach sequences."
            actions={[
              {
                label: "Create Template",
                icon: <PlusIcon size={18} weight="bold" />,
                variant: "primary",
                onClick: openCreate,
              },
            ]}
          />
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-serif text-neutral-950 dark:text-neutral-50">
              {editingTemplate ? "Edit Template" : "Create Template"}
            </h2>
            <button
              onClick={() => setShowModal(false)}
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <XIcon size={20} className="text-neutral-500" />
            </button>
          </div>

          <div className="space-y-4">
            <Input
              label="Name"
              required
              placeholder="e.g. Cold Intro Email"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
            <Select
              label="Category"
              options={categoryOptions}
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
            />
            <Input
              label="Subject"
              required
              placeholder="e.g. Quick question about {{company}}"
              value={formSubject}
              onChange={(e) => setFormSubject(e.target.value)}
            />
            <div>
              <Textarea
                label="Body"
                required
                placeholder="Write your email template..."
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                rows={8}
              />
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="text-xs text-neutral-500 mr-1 py-1">
                  Insert:
                </span>
                {mergeFieldOptions.map((field) => (
                  <button
                    key={field}
                    type="button"
                    onClick={() => insertMergeField(field)}
                    className="inline-flex px-2 py-1 text-[11px] font-mono rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    {field}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={isPending}
            >
              {isPending
                ? "Saving..."
                : editingTemplate
                  ? "Update Template"
                  : "Create Template"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal
        open={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
      >
        {previewTemplate && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-serif text-neutral-950 dark:text-neutral-50">
                {previewTemplate.name}
              </h2>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="flex h-8 w-8 items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <XIcon size={20} className="text-neutral-500" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Subject
                </label>
                <p className="text-sm text-neutral-950 dark:text-neutral-50 mt-1">
                  {previewTemplate.subject}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Body
                </label>
                <div className="mt-1 p-4 rounded bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800">
                  <pre className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap font-sans">
                    {previewTemplate.body}
                  </pre>
                </div>
              </div>
              {previewTemplate.merge_fields &&
                previewTemplate.merge_fields.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      Merge Fields
                    </label>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {previewTemplate.merge_fields.map((field) => (
                        <span
                          key={field}
                          className="inline-flex px-2 py-1 text-[11px] font-mono rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setPreviewTemplate(null);
                openEdit(previewTemplate);
              }}
            >
              Edit Template
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
