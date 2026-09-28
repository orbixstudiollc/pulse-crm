"use client";

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import {
  Button,
  Badge,
  Modal,
  Input,
  Select,
  Textarea,
  ActionMenu,
  Progress,
  Drawer,
  PlusIcon,
  EyeIcon,
  PencilSimpleIcon,
  TrashIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  ClockIcon,
  XIcon,
  PaperPlaneTiltIcon,
  ChartBarIcon,
  CursorClickIcon,
  ChatCircleIcon,
  CopyIcon,
  ArrowPathIcon,
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
  cloneSequence,
  getSequencePerformanceSummary,
} from "@/lib/actions/sequences";
import type { SequenceWithKPIs, PerformanceSummary } from "@/lib/actions/sequences";
import { chartAccent, chartSuccess, chartTooltipStyle } from "@/lib/design-system/chart-colors";
import { cn } from "@/lib/utils";

// ── Config ───────────────────────────────────────────────────────────────────

const statusConfig: Record<
  string,
  { label: string; variant: "neutral" | "success" | "warning" | "error" }
> = {
  draft: { label: "Draft", variant: "neutral" },
  active: { label: "Active", variant: "success" },
  paused: { label: "Paused", variant: "warning" },
  archived: { label: "Archived", variant: "error" },
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

// ── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  sequenceName,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sequenceName: string;
  isPending: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-surface">
            <TrashIcon size={20} className="text-danger" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-fg">
              Delete Sequence
            </h3>
            <p className="text-sm text-fg-secondary mt-0.5">
              This action cannot be undone.
            </p>
          </div>
        </div>
        <p className="text-sm text-fg-secondary">
          Are you sure you want to delete <span className="font-medium">&quot;{sequenceName}&quot;</span>?
          All steps, enrollments, and events associated with this sequence will be permanently removed.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1 !bg-danger hover:!bg-danger !text-on-inverse"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Deleting..." : "Delete Sequence"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Inline Status Toggle ─────────────────────────────────────────────────────

function StatusToggle({
  status,
  onToggle,
  isPending,
}: {
  status: string;
  onToggle: () => void;
  isPending: boolean;
}) {
  if (status === "draft") {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border border-accent bg-accent-surface text-accent-on-surface hover:bg-accent-surface transition-colors disabled:opacity-50"
      >
        <CheckCircleIcon size={14} />
        Activate
      </button>
    );
  }

  const isActive = status === "active";

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      disabled={isPending}
      className="group relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50"
      style={{
        backgroundColor: isActive ? "var(--success-fill)" : "var(--fg-muted)",
      }}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-surface transition-transform",
          isActive ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}

// ── Count-Up Hook ─────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const startTime = performance.now();
    const startVal = 0;
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(startVal + (target - startVal) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

// ── Component ────────────────────────────────────────────────────────────────

export function SequencesPageClient({
  initialSequences,
}: {
  initialSequences: SequenceWithKPIs[];
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

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Performance drawer state
  const [perfDrawer, setPerfDrawer] = useState<{
    open: boolean;
    sequenceId: string;
    sequenceName: string;
    loading: boolean;
    data: PerformanceSummary | null;
  }>({ open: false, sequenceId: "", sequenceName: "", loading: false, data: null });

  // Inline editing state
  const [editingName, setEditingName] = useState<{ id: string; value: string } | null>(null);
  const editNameRef = useRef<HTMLInputElement>(null);

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
    startIndex + perPage,
  );
  const displayStart = startIndex + 1;
  const displayEnd = Math.min(
    startIndex + perPage,
    filteredSequences.length,
  );

  // Aggregate stats
  const totalSequences = sequences.length;
  const activeSequences = sequences.filter(
    (s) => s.status === "active",
  ).length;
  const totalSent = sequences.reduce((sum, s) => sum + (s.total_sent || 0), 0);
  const totalOpened = sequences.reduce((sum, s) => sum + (s.total_opened || 0), 0);
  const totalClicked = sequences.reduce((sum, s) => sum + (s.total_clicked || 0), 0);
  const totalReplied = sequences.reduce((sum, s) => sum + (s.total_replied || 0), 0);
  const avgOpenRate =
    totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
  const avgClickRate =
    totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0;
  const avgReplyRate =
    totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;

  // Count-up animated values
  const animTotalSeq = useCountUp(totalSequences);
  const animActiveSeq = useCountUp(activeSequences);
  const animTotalSent = useCountUp(totalSent);
  const animOpenRate = useCountUp(avgOpenRate);
  const animClickRate = useCountUp(avgClickRate);
  const animReplyRate = useCountUp(avgReplyRate);

  // Inline edit name handlers
  const handleInlineNameSave = useCallback((id: string, newName: string) => {
    if (!newName.trim()) { setEditingName(null); return; }
    startTransition(async () => {
      const result = await updateSequence(id, { name: newName.trim() });
      if (result.error) toast.error(result.error);
      else { toast.success("Name updated"); router.refresh(); }
      setEditingName(null);
    });
  }, [router]);

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
        setDeleteTarget(null);
        router.refresh();
      }
    });
  };

  const handleToggleStatus = (
    id: string,
    currentStatus: string,
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
          `Sequence ${newStatus === "active" ? "activated" : "paused"}`,
        );
        router.refresh();
      }
    });
  };

  const handleClone = useCallback((id: string) => {
    startTransition(async () => {
      const result = await cloneSequence(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Sequence cloned");
        router.refresh();
      }
    });
  }, [router]);

  const openPerformanceDrawer = useCallback(async (sequenceId: string, sequenceName: string) => {
    setPerfDrawer({ open: true, sequenceId, sequenceName, loading: true, data: null });
    const result = await getSequencePerformanceSummary(sequenceId);
    setPerfDrawer((prev) => ({
      ...prev,
      loading: false,
      data: result.data as PerformanceSummary,
    }));
  }, []);

  const eventLabels: Record<string, { label: string; color: string }> = {
    email_sent: { label: "Sent", color: "text-accent-strong" },
    email_opened: { label: "Opened", color: "text-success" },
    link_clicked: { label: "Clicked", color: "text-accent-strong" },
    email_replied: { label: "Replied", color: "text-success" },
    email_bounced: { label: "Bounced", color: "text-danger" },
    unsubscribed: { label: "Unsubscribed", color: "text-warning" },
  };

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-6 space-y-4">
      {/* Header */}
      <PageHeader title="Sequences">
        <Button
          leftIcon={<PlusIcon size={20} weight="bold" />}
          onClick={() => setShowCreateModal(true)}
        >
          Create Sequence
        </Button>
      </PageHeader>

      {/* 6 KPI Stat Cards — Animated Count-Up */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Total Sequences"
          value={animTotalSeq.toString()}
          icon={<EnvelopeIcon size={24} className="text-fg" />}
        />
        <StatCard
          label="Active"
          value={animActiveSeq.toString()}
          icon={<CheckCircleIcon size={24} className="text-fg" />}
        />
        <StatCard
          label="Total Sent"
          value={animTotalSent.toLocaleString()}
          icon={<PaperPlaneTiltIcon size={24} className="text-fg" />}
        />
        <StatCard
          label="Avg Open Rate"
          value={`${animOpenRate}%`}
          icon={<ChartBarIcon size={24} className="text-fg" />}
        />
        <StatCard
          label="Avg Click Rate"
          value={`${animClickRate}%`}
          icon={<CursorClickIcon size={24} className="text-fg" />}
        />
        <StatCard
          label="Avg Reply Rate"
          value={`${animReplyRate}%`}
          icon={<ChatCircleIcon size={24} className="text-fg" />}
        />
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-line bg-surface p-1.5">
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
                ? "bg-inverse text-on-inverse"
                : "text-fg-secondary hover:text-fg hover:bg-muted",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Enhanced Table — Instantly-style columns */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="rounded-lg border border-line bg-surface overflow-hidden"
      >
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
                  <tr className="bg-muted">
                    <th className="px-3 py-2 text-left text-[13px] font-medium text-fg-secondary">
                      Name
                    </th>
                    <th className="px-3 py-2 text-center text-[13px] font-medium text-fg-secondary">
                      Status
                    </th>
                    <th className="px-3 py-2 text-left text-[13px] font-medium text-fg-secondary">
                      Progress
                    </th>
                    <th className="px-3 py-2 text-left text-[13px] font-medium text-fg-secondary">
                      Sent
                    </th>
                    <th className="px-3 py-2 text-left text-[13px] font-medium text-fg-secondary">
                      Open Rate
                    </th>
                    <th className="px-3 py-2 text-left text-[13px] font-medium text-fg-secondary">
                      Reply Rate
                    </th>
                    <th className="px-3 py-2 text-center text-[13px] font-medium text-fg-secondary">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSequences.map((seq) => {
                    const status =
                      statusConfig[seq.status] || statusConfig.draft;
                    const enrolled = seq.total_enrolled || 0;
                    const completed = seq.total_replied || 0;
                    const progressPct =
                      enrolled > 0
                        ? Math.round((completed / enrolled) * 100)
                        : 0;

                    return (
                      <tr
                        key={seq.id}
                        onClick={() =>
                          router.push(
                            `/dashboard/sequences/${seq.id}`,
                          )
                        }
                        className="hover:bg-muted transition-colors cursor-pointer"
                      >
                        {/* Name + Description + Category — inline editing */}
                        <td className="px-3 py-2 border-t border-row">
                          <div>
                            {editingName?.id === seq.id ? (
                              <input
                                ref={editNameRef}
                                autoFocus
                                defaultValue={editingName.value}
                                className="text-sm font-medium text-fg bg-transparent border-b border-inverse outline-none w-full"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleInlineNameSave(seq.id, e.currentTarget.value);
                                  if (e.key === "Escape") setEditingName(null);
                                }}
                                onBlur={(e) => handleInlineNameSave(seq.id, e.currentTarget.value)}
                              />
                            ) : (
                              <p
                                className="text-sm font-medium text-fg cursor-text"
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  setEditingName({ id: seq.id, value: seq.name });
                                }}
                              >
                                {seq.name}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-0.5">
                              {seq.description && (
                                <p className="text-xs text-fg-secondary line-clamp-1">
                                  {seq.description}
                                </p>
                              )}
                              {seq.category && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-fg-secondary whitespace-nowrap">
                                  {categoryConfig[seq.category] || seq.category}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        {/* Inline Status Toggle */}
                        <td className="px-3 py-2 border-t border-row">
                          <div className="flex justify-center">
                            <StatusToggle
                              status={seq.status}
                              onToggle={() =>
                                handleToggleStatus(seq.id, seq.status)
                              }
                              isPending={isPending}
                            />
                          </div>
                        </td>
                        {/* Progress bar — enrolled vs replied */}
                        <td className="px-3 py-2 border-t border-row">
                          <div className="min-w-[100px]">
                            <div className="flex items-center justify-between text-xs text-fg-secondary mb-1">
                              <span>{enrolled} enrolled</span>
                              <span>{progressPct}%</span>
                            </div>
                            <Progress
                              value={completed}
                              max={enrolled || 1}
                              className="h-1.5"
                            />
                          </div>
                        </td>
                        {/* Sent */}
                        <td className="px-3 py-2 border-t border-row">
                          <span className="text-sm font-medium font-semibold text-fg">
                            {(seq.total_sent || 0).toLocaleString()}
                          </span>
                        </td>
                        {/* Open Rate */}
                        <td className="px-3 py-2 border-t border-row">
                          <span
                            className={cn(
                              "text-sm font-medium font-semibold",
                              (seq.open_rate || 0) >= 50
                                ? "text-success"
                                : (seq.open_rate || 0) >= 25
                                  ? "text-warning"
                                  : "text-fg",
                            )}
                          >
                            {seq.open_rate || 0}%
                          </span>
                        </td>
                        {/* Reply Rate */}
                        <td className="px-3 py-2 border-t border-row">
                          <span
                            className={cn(
                              "text-sm font-medium font-semibold",
                              (seq.reply_rate || 0) >= 10
                                ? "text-success"
                                : (seq.reply_rate || 0) >= 5
                                  ? "text-warning"
                                  : "text-fg",
                            )}
                          >
                            {seq.reply_rate || 0}%
                          </span>
                        </td>
                        {/* Actions */}
                        <td
                          className="px-3 py-2 border-t border-row"
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
                                  label: "Clone",
                                  icon: <CopyIcon size={18} />,
                                  onClick: () => handleClone(seq.id),
                                },
                                {
                                  label: "Performance",
                                  icon: <ChartBarIcon size={18} />,
                                  onClick: () =>
                                    openPerformanceDrawer(seq.id, seq.name),
                                },
                                {
                                  label: "Delete",
                                  icon: <TrashIcon size={18} />,
                                  onClick: () =>
                                    setDeleteTarget({
                                      id: seq.id,
                                      name: seq.name,
                                    }),
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
      </motion.div>

      {/* Create Sequence Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      >
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-fg">
              Create Sequence
            </h2>
            <button
              onClick={() => setShowCreateModal(false)}
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
            >
              <XIcon size={20} className="text-fg-secondary" />
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
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
            >
              {categoryOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
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

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
        sequenceName={deleteTarget?.name || ""}
        isPending={isPending}
      />

      {/* Performance Drawer */}
      <Drawer
        open={perfDrawer.open}
        onClose={() => setPerfDrawer((prev) => ({ ...prev, open: false }))}
        title={`Performance — ${perfDrawer.sequenceName}`}
        footer={
          <Button
            className="w-full"
            onClick={() => {
              setPerfDrawer((prev) => ({ ...prev, open: false }));
              router.push(`/dashboard/sequences/${perfDrawer.sequenceId}`);
            }}
          >
            View Full Details
          </Button>
        }
      >
        {perfDrawer.loading ? (
          <div className="space-y-6">
            {/* Skeleton for funnel */}
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 rounded bg-muted animate-pulse" />
              ))}
            </div>
            {/* Skeleton for sparkline */}
            <div className="h-32 rounded bg-muted animate-pulse" />
            {/* Skeleton for events */}
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded bg-muted animate-pulse" />
              ))}
            </div>
          </div>
        ) : perfDrawer.data ? (
          <div className="space-y-6">
            {/* Mini Funnel Bars */}
            <div>
              <h4 className="text-sm font-medium text-fg mb-3">
                Funnel Overview
              </h4>
              <div className="space-y-2">
                {(() => {
                  const f = perfDrawer.data.funnel;
                  const maxVal = Math.max(f.sent, 1);
                  const bars = [
                    { label: "Sent", value: f.sent, color: "bg-accent-strong" },
                    { label: "Opened", value: f.opened, color: "bg-success" },
                    { label: "Clicked", value: f.clicked, color: "bg-accent-strong" },
                    { label: "Replied", value: f.replied, color: "bg-success" },
                  ];
                  return bars.map((bar) => (
                    <div key={bar.label} className="flex items-center gap-3">
                      <span className="text-xs text-fg-secondary w-16">
                        {bar.label}
                      </span>
                      <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", bar.color)}
                          style={{
                            width: `${Math.max((bar.value / maxVal) * 100, bar.value > 0 ? 4 : 0)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-fg w-10 text-right">
                        {bar.value}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* 14-day Sparkline */}
            <div>
              <h4 className="text-sm font-medium text-fg mb-3">
                14-Day Activity
              </h4>
              <div className="h-32 rounded border border-line p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={perfDrawer.data.sparkline}>
                    <defs>
                      <linearGradient id="perfSent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartAccent} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={chartAccent} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="perfReplied" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartSuccess} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={chartSuccess} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <RechartsTooltip
                      contentStyle={chartTooltipStyle}
                    />
                    <Area
                      type="monotone"
                      dataKey="sent"
                      stroke={chartAccent}
                      fill="url(#perfSent)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="replied"
                      stroke={chartSuccess}
                      fill="url(#perfReplied)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Step */}
            {perfDrawer.data.topStep && (
              <div>
                <h4 className="text-sm font-medium text-fg mb-2">
                  Top Performing Step
                </h4>
                <div className="p-3 rounded border border-success bg-success-surface">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-success font-medium">
                        Step {perfDrawer.data.topStep.stepOrder}
                      </p>
                      <p className="text-sm text-fg mt-0.5 line-clamp-1">
                        {perfDrawer.data.topStep.subject || "Untitled"}
                      </p>
                    </div>
                    <Badge variant="success">
                      {perfDrawer.data.topStep.replyRate}% reply
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Events */}
            <div>
              <h4 className="text-sm font-medium text-fg mb-2">
                Recent Activity
              </h4>
              {perfDrawer.data.recentEvents.length > 0 ? (
                <div className="space-y-1">
                  {perfDrawer.data.recentEvents.map((evt, i) => {
                    const info = eventLabels[evt.eventType] || { label: evt.eventType, color: "text-fg-secondary" };
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted"
                      >
                        <span className={cn("text-xs font-medium", info.color)}>
                          {info.label}
                        </span>
                        <span className="text-xs text-fg-muted">
                          {new Date(evt.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-fg-muted py-3 text-center">
                  No recent activity
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-fg-secondary text-center py-8">
            No data available
          </p>
        )}
      </Drawer>
    </div>
  );
}
