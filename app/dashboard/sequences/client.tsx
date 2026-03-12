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
  CheckCircleIcon,
  ClockIcon,
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
  createSequence,
  updateSequence,
  deleteSequence,
} from "@/lib/actions/sequences";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface SequenceRecord {
  id: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  total_steps: number;
  total_enrolled: number;
  reply_rate: number;
  created_at: string;
  [key: string]: unknown;
}

// ── Config ───────────────────────────────────────────────────────────────────

const statusConfig: Record<
  string,
  { label: string; variant: "neutral" | "green" | "amber" | "red" }
> = {
  draft: { label: "Draft", variant: "neutral" },
  active: { label: "Active", variant: "green" },
  paused: { label: "Paused", variant: "amber" },
  archived: { label: "Archived", variant: "red" },
};

const categoryConfig: Record<string, string> = {
  cold_outreach: "Cold Outreach",
  warm_followup: "Warm Follow-up",
  re_engagement: "Re-engagement",
  post_demo: "Post-Demo",
  nurture: "Nurture",
};

const categoryTabs = [
  { label: "All", value: "all" },
  { label: "Cold Outreach", value: "cold_outreach" },
  { label: "Warm Follow-up", value: "warm_followup" },
  { label: "Re-engagement", value: "re_engagement" },
  { label: "Post-Demo", value: "post_demo" },
  { label: "Nurture", value: "nurture" },
];

const categoryOptions = [
  { label: "Cold Outreach", value: "cold_outreach" },
  { label: "Warm Follow-up", value: "warm_followup" },
  { label: "Re-engagement", value: "re_engagement" },
  { label: "Post-Demo", value: "post_demo" },
  { label: "Nurture", value: "nurture" },
];

// ── Component ────────────────────────────────────────────────────────────────

export function SequencesPageClient({
  initialSequences,
}: {
  initialSequences: SequenceRecord[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState("10");

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("cold_outreach");

  const sequences = initialSequences;

  // Filter by category tab
  const filteredSequences =
    activeTab === "all"
      ? sequences
      : sequences.filter((s) => s.category === activeTab);

  // Pagination
  const perPage = parseInt(rowsPerPage);
  const totalPages = Math.ceil(filteredSequences.length / perPage);
  const startIndex = (currentPage - 1) * perPage;
  const paginatedSequences = filteredSequences.slice(
    startIndex,
    startIndex + perPage
  );
  const displayStart = startIndex + 1;
  const displayEnd = Math.min(
    startIndex + perPage,
    filteredSequences.length
  );

  // Stats
  const totalSequences = sequences.length;
  const activeSequences = sequences.filter(
    (s) => s.status === "active"
  ).length;
  const avgReplyRate =
    sequences.length > 0
      ? Math.round(
          sequences.reduce((sum, s) => sum + (s.reply_rate || 0), 0) /
            sequences.length
        )
      : 0;

  const handleCreate = () => {
    if (!formName.trim()) {
      toast.error("Name is required");
      return;
    }

    startTransition(async () => {
      const result = await createSequence({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        category: formCategory,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Sequence created");
        setShowCreateModal(false);
        setFormName("");
        setFormDescription("");
        setFormCategory("cold_outreach");
        router.refresh();
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteSequence(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Sequence deleted");
        router.refresh();
      }
    });
  };

  const handleToggleStatus = (
    id: string,
    currentStatus: string
  ) => {
    const newStatus =
      currentStatus === "active" ? "paused" : "active";

    startTransition(async () => {
      const result = await updateSequence(id, {
        status: newStatus as "active" | "paused",
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          `Sequence ${newStatus === "active" ? "activated" : "paused"}`
        );
        router.refresh();
      }
    });
  };

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 space-y-4">
      {/* Header */}
      <PageHeader title="Sequences">
        <Button
          leftIcon={<PlusIcon size={20} weight="bold" />}
          onClick={() => setShowCreateModal(true)}
        >
          Create Sequence
        </Button>
      </PageHeader>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Sequences"
          value={totalSequences.toString()}
          icon={
            <EnvelopeIcon
              size={24}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
        <StatCard
          label="Active Sequences"
          value={activeSequences.toString()}
          icon={
            <CheckCircleIcon
              size={24}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
        <StatCard
          label="Avg Reply Rate"
          value={`${avgReplyRate}%`}
          icon={
            <ClockIcon
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
              "px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors",
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
          title="All Sequences"
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(value) => {
            setRowsPerPage(value);
            setCurrentPage(1);
          }}
        />

        {filteredSequences.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-[0.5px] border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
                    <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3">
                      Name
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                      Category
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                      Status
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                      Steps
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                      Enrolled
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                      Reply Rate
                    </th>
                    <th className="text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 px-3 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSequences.map((seq) => {
                    const status =
                      statusConfig[seq.status] || statusConfig.draft;
                    const categoryLabel =
                      categoryConfig[seq.category] || seq.category;

                    return (
                      <tr
                        key={seq.id}
                        onClick={() =>
                          router.push(
                            `/dashboard/sequences/${seq.id}`
                          )
                        }
                        className="border-b-[0.5px] border-neutral-200 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-4">
                          <div>
                            <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                              {seq.name}
                            </p>
                            {seq.description && (
                              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1">
                                {seq.description}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                          <span className="text-sm text-neutral-600 dark:text-neutral-400">
                            {categoryLabel}
                          </span>
                        </td>
                        <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                          <Badge variant={status.variant} dot>
                            {status.label}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                          <span className="text-sm font-medium font-serif text-neutral-950 dark:text-neutral-50">
                            {seq.total_steps || 0}
                          </span>
                        </td>
                        <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                          <span className="text-sm font-medium font-serif text-neutral-950 dark:text-neutral-50">
                            {seq.total_enrolled || 0}
                          </span>
                        </td>
                        <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                          <span className="text-sm font-medium font-serif text-neutral-950 dark:text-neutral-50">
                            {seq.reply_rate || 0}%
                          </span>
                        </td>
                        <td
                          className="px-3 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-center">
                            <ActionMenu
                              items={[
                                {
                                  label: "View Details",
                                  icon: <EyeIcon size={18} />,
                                  href: `/dashboard/sequences/${seq.id}`,
                                },
                                {
                                  label: "Edit",
                                  icon: (
                                    <PencilSimpleIcon size={18} />
                                  ),
                                  href: `/dashboard/sequences/${seq.id}`,
                                },
                                {
                                  label:
                                    seq.status === "active"
                                      ? "Pause"
                                      : "Activate",
                                  icon: (
                                    seq.status === "active" ? (
                                      <ClockIcon size={18} />
                                    ) : (
                                      <CheckCircleIcon size={18} />
                                    )
                                  ),
                                  onClick: () =>
                                    handleToggleStatus(
                                      seq.id,
                                      seq.status
                                    ),
                                },
                                {
                                  label: "Delete",
                                  icon: <TrashIcon size={18} />,
                                  onClick: () =>
                                    handleDelete(seq.id),
                                  variant: "danger",
                                },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <TableFooter
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredSequences.length}
              startIndex={displayStart}
              endIndex={displayEnd}
              onPageChange={setCurrentPage}
              itemLabel="sequences"
            />
          </>
        ) : (
          <EmptyState
            icon={<EnvelopeIcon size={24} />}
            title={
              activeTab !== "all"
                ? "No sequences in this category"
                : "No sequences yet"
            }
            description={
              activeTab !== "all"
                ? "Try selecting a different category or create a new sequence."
                : "Create your first outreach sequence to automate lead engagement."
            }
            actions={[
              {
                label: "Create Sequence",
                icon: <PlusIcon size={18} weight="bold" />,
                variant: "primary",
                onClick: () => setShowCreateModal(true),
              },
            ]}
          />
        )}
      </div>

      {/* Create Sequence Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      >
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-serif text-neutral-950 dark:text-neutral-50">
              Create Sequence
            </h2>
            <button
              onClick={() => setShowCreateModal(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <XIcon size={20} className="text-neutral-500" />
            </button>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <Input
              label="Name"
              required
              placeholder="e.g. Cold Outreach Q1"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
            <Textarea
              label="Description"
              placeholder="Describe the purpose of this sequence..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
            />
            <Select
              label="Category"
              required
              options={categoryOptions}
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleCreate}
              disabled={isPending}
            >
              {isPending ? "Creating..." : "Create Sequence"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
