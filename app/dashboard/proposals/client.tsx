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
  DeleteConfirmModal,
  PlusIcon,
  EyeIcon,
  PencilSimpleIcon,
  TrashIcon,
  FileTextIcon,
  ScrollIcon,
  CheckCircleIcon,
  ClockIcon,
  XIcon,
} from "@/components/ui";
import {
  Page,
  PageHeader,
  MetricStrip,
  PageTabs,
  TableSection,
  StatCard,
  TableHeader,
  TableFooter,
  EmptyState,
} from "@/components/dashboard";
import { AIGenerateModal } from "@/components/features";
import { SparkleIcon } from "@/components/ui/Icons";
import {
  createProposal,
  updateProposal,
  deleteProposal,
  markProposalSent,
} from "@/lib/actions/proposals";
import { aiGenerateProposal } from "@/lib/actions/ai-proposals";

// ── Types ────────────────────────────────────────────────────────────────────

interface ProposalRecord {
  id: string;
  title: string;
  status: string;
  deal_id: string | null;
  content: unknown;
  pricing_tiers: unknown;
  valid_until: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

interface DealRecord {
  id: string;
  name: string;
  value: number | null;
  stage: string;
  [key: string]: unknown;
}

interface PricingTier {
  name: string;
  price: string;
}

// ── Config ───────────────────────────────────────────────────────────────────

const statusConfig: Record<
  string,
  { label: string; variant: "neutral" | "info" | "warning" | "success" | "error" }
> = {
  draft: { label: "Draft", variant: "neutral" },
  sent: { label: "Sent", variant: "info" },
  viewed: { label: "Viewed", variant: "warning" },
  accepted: { label: "Accepted", variant: "success" },
  rejected: { label: "Rejected", variant: "error" },
};

const statusTabs = [
  { label: "All", id: "all" },
  { label: "Draft", id: "draft" },
  { label: "Sent", id: "sent" },
  { label: "Viewed", id: "viewed" },
  { label: "Accepted", id: "accepted" },
  { label: "Rejected", id: "rejected" },
];

const statusOptions = [
  { label: "Draft", value: "draft" },
  { label: "Sent", value: "sent" },
  { label: "Viewed", value: "viewed" },
  { label: "Accepted", value: "accepted" },
  { label: "Rejected", value: "rejected" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function parsePricingTiers(raw: unknown): PricingTier[] {
  if (!raw || typeof raw !== "object") return [];
  if (Array.isArray(raw)) {
    return raw.filter(
      (t) =>
        t && typeof t === "object" && "name" in t && "price" in t
    ) as PricingTier[];
  }
  return [];
}

function parseExecutiveSummary(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const obj = raw as Record<string, unknown>;
  if (typeof obj.executive_summary === "string") return obj.executive_summary;
  return "";
}

// ── Component ────────────────────────────────────────────────────────────────

export function ProposalsPageClient({
  initialProposals,
  deals = [],
}: {
  initialProposals: ProposalRecord[];
  deals?: DealRecord[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [editingProposal, setEditingProposal] =
    useState<ProposalRecord | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState("10");

  // AI Generate state
  const [aiProposalOpen, setAIProposalOpen] = useState(false);
  const [selectedDealIdForAI, setSelectedDealIdForAI] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<ProposalRecord | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formStatus, setFormStatus] = useState("draft");
  const [formValidUntil, setFormValidUntil] = useState("");
  const [formSummary, setFormSummary] = useState("");
  const [formTiers, setFormTiers] = useState<PricingTier[]>([]);
  const [tierName, setTierName] = useState("");
  const [tierPrice, setTierPrice] = useState("");

  const proposals = initialProposals;

  // Filter by status tab
  const filteredProposals =
    activeTab === "all"
      ? proposals
      : proposals.filter((p) => p.status === activeTab);

  // Pagination
  const perPage = parseInt(rowsPerPage);
  const totalPages = Math.ceil(filteredProposals.length / perPage);
  const startIndex = (currentPage - 1) * perPage;
  const paginatedProposals = filteredProposals.slice(
    startIndex,
    startIndex + perPage
  );
  const displayStart = startIndex + 1;
  const displayEnd = Math.min(
    startIndex + perPage,
    filteredProposals.length
  );

  // Stats
  const totalProposals = proposals.length;
  const draftProposals = proposals.filter((p) => p.status === "draft").length;
  const sentProposals = proposals.filter(
    (p) => p.status === "sent" || p.status === "viewed"
  ).length;
  const acceptedProposals = proposals.filter(
    (p) => p.status === "accepted"
  ).length;

  // ── Form helpers ─────────────────────────────────────────────────────────

  const resetForm = () => {
    setFormTitle("");
    setFormStatus("draft");
    setFormValidUntil("");
    setFormSummary("");
    setFormTiers([]);
    setTierName("");
    setTierPrice("");
    setEditingProposal(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (proposal: ProposalRecord) => {
    setEditingProposal(proposal);
    setFormTitle(proposal.title);
    setFormStatus(proposal.status);
    setFormValidUntil(proposal.valid_until ?? "");
    setFormSummary(parseExecutiveSummary(proposal.content));
    setFormTiers(parsePricingTiers(proposal.pricing_tiers));
    setTierName("");
    setTierPrice("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const addTier = () => {
    if (tierName.trim() && tierPrice.trim()) {
      setFormTiers([
        ...formTiers,
        { name: tierName.trim(), price: tierPrice.trim() },
      ]);
      setTierName("");
      setTierPrice("");
    }
  };

  const removeTier = (index: number) => {
    setFormTiers(formTiers.filter((_, i) => i !== index));
  };

  // ── Mutations ──────────────────────────────────────────────────────────

  const handleSubmit = () => {
    if (!formTitle.trim()) {
      toast.error("Title is required");
      return;
    }

    startTransition(async () => {
      const contentPayload: Record<string, unknown> = {};
      if (formSummary.trim()) {
        contentPayload.executive_summary = formSummary.trim();
      }

      const pricingPayload = formTiers.length > 0 ? formTiers : undefined;

      if (editingProposal) {
        const result = await updateProposal(editingProposal.id, {
          title: formTitle.trim(),
          status: formStatus,
          valid_until: formValidUntil || null,
          content:
            Object.keys(contentPayload).length > 0
              ? contentPayload
              : undefined,
          pricing_tiers: pricingPayload
            ? (pricingPayload as unknown as Record<string, unknown>)
            : undefined,
        });

        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Proposal updated");
          closeModal();
          router.refresh();
        }
      } else {
        const result = await createProposal({
          title: formTitle.trim(),
          valid_until: formValidUntil || undefined,
          content:
            Object.keys(contentPayload).length > 0
              ? contentPayload
              : undefined,
          pricing_tiers: pricingPayload
            ? (pricingPayload as unknown as Record<string, unknown>)
            : undefined,
        });

        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Proposal created");
          closeModal();
          router.refresh();
        }
      }
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteProposal(deleteTarget.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Proposal deleted");
        setDeleteTarget(null);
        router.refresh();
      }
    });
  };

  const handleMarkSent = (id: string) => {
    startTransition(async () => {
      const result = await markProposalSent(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Marked as sent");
        router.refresh();
      }
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <Page>
      {/* Header */}
      <PageHeader title="Proposals" icon={<ScrollIcon size={18} />}>
        <Button
          variant="outline"
          leftIcon={<SparkleIcon size={18} />}
          onClick={() => setAIProposalOpen(true)}
        >
          AI Generate
        </Button>
        <Button
          leftIcon={<PlusIcon size={20} weight="bold" />}
          onClick={openCreateModal}
        >
          New Proposal
        </Button>
      </PageHeader>

      {/* Stat Cards */}
      <MetricStrip>
        <StatCard
          label="Total Proposals"
          value={totalProposals.toString()}
          icon={
            <FileTextIcon
              size={24}
              className="text-fg"
            />
          }
        />
        <StatCard
          label="Draft"
          value={draftProposals.toString()}
          icon={
            <FileTextIcon
              size={24}
              className="text-fg"
            />
          }
        />
        <StatCard
          label="Sent"
          value={sentProposals.toString()}
          icon={
            <ClockIcon
              size={24}
              className="text-fg"
            />
          }
        />
        <StatCard
          label="Accepted"
          value={acceptedProposals.toString()}
          icon={
            <CheckCircleIcon
              size={24}
              className="text-fg"
            />
          }
        />
      </MetricStrip>

      {/* Status Tabs */}
      <PageTabs
        tabs={statusTabs}
        value={activeTab}
        onChange={(id) => {
          setActiveTab(id);
          setCurrentPage(1);
        }}
        className="max-sm:overflow-x-auto max-sm:overflow-y-hidden"
      />

      {/* Table */}
        <TableHeader
          title="All Proposals"
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(value) => {
            setRowsPerPage(value);
            setCurrentPage(1);
          }}
        />

        {filteredProposals.length > 0 ? (
          <>
            <TableSection>
              <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left text-[13px] font-medium text-fg-secondary">
                      Title
                    </th>
                    <th className="text-left text-[13px] font-medium text-fg-secondary">
                      Status
                    </th>
                    <th className="text-left text-[13px] font-medium text-fg-secondary">
                      Valid Until
                    </th>
                    <th className="text-left text-[13px] font-medium text-fg-secondary">
                      Created
                    </th>
                    <th className="text-right text-[13px] font-medium text-fg-secondary">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProposals.map((proposal) => {
                    const status =
                      statusConfig[proposal.status] || statusConfig.draft;

                    return (
                      <tr
                        key={proposal.id}
                        onClick={() =>
                          router.push(
                            `/dashboard/proposals/${proposal.id}`
                          )
                        }
                        className="hover:bg-subtle transition-colors cursor-pointer"
                      >
                        <td className="py-2 text-[14px] text-fg">
                          <div className="flex items-center gap-2">
                            <ScrollIcon size={16} className="shrink-0 text-fg-muted" />
                            <p className="text-[14px] font-medium text-fg">
                              {proposal.title}
                            </p>
                          </div>
                        </td>
                        <td className="py-2 text-[14px] text-fg">
                          <Badge variant={status.variant} dot>
                            {status.label}
                          </Badge>
                        </td>
                        <td className="py-2 text-[14px] text-fg">
                          <span className="text-[14px] text-fg-secondary">
                            {proposal.valid_until
                              ? new Date(
                                  proposal.valid_until
                                ).toLocaleDateString()
                              : "\u2014"}
                          </span>
                        </td>
                        <td className="py-2 text-[14px] text-fg">
                          <span className="text-[14px] text-fg-secondary">
                            {new Date(
                              proposal.created_at
                            ).toLocaleDateString()}
                          </span>
                        </td>
                        <td
                          className="py-2 text-[14px] text-fg"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-end">
                            <ActionMenu
                              items={[
                                {
                                  label: "View",
                                  icon: <EyeIcon size={18} />,
                                  href: `/dashboard/proposals/${proposal.id}`,
                                },
                                {
                                  label: "Edit",
                                  icon: (
                                    <PencilSimpleIcon size={18} />
                                  ),
                                  onClick: () =>
                                    openEditModal(proposal),
                                },
                                ...(proposal.deal_id
                                  ? [
                                      {
                                        label: "AI Regenerate",
                                        icon: (
                                          <SparkleIcon className="w-[18px] h-[18px]" />
                                        ),
                                        onClick: () => {
                                          setSelectedDealIdForAI(proposal.deal_id);
                                          setAIProposalOpen(true);
                                        },
                                      },
                                    ]
                                  : []),
                                ...(proposal.status === "draft"
                                  ? [
                                      {
                                        label: "Mark as sent",
                                        icon: (
                                          <CheckCircleIcon
                                            size={18}
                                          />
                                        ),
                                        onClick: () =>
                                          handleMarkSent(
                                            proposal.id
                                          ),
                                      },
                                    ]
                                  : []),
                                {
                                  label: "Delete",
                                  icon: <TrashIcon size={18} />,
                                  onClick: () =>
                                    setDeleteTarget(proposal),
                                  variant: "danger" as const,
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
            </TableSection>

            <TableFooter
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredProposals.length}
              startIndex={displayStart}
              endIndex={displayEnd}
              onPageChange={setCurrentPage}
              itemLabel="proposals"
            />
          </>
        ) : (
          <EmptyState
            icon={<FileTextIcon size={24} />}
            title={
              activeTab !== "all"
                ? "No proposals with this status"
                : "No proposals yet"
            }
            description={
              activeTab !== "all"
                ? "Try selecting a different status or create a new proposal."
                : "Create your first proposal to start closing deals faster."
            }
            actions={[
              {
                label: "New Proposal",
                icon: <PlusIcon size={18} weight="bold" />,
                variant: "primary",
                onClick: openCreateModal,
              },
            ]}
          />
        )}

      {/* Create / Edit Proposal Modal */}
      <Modal open={showModal} onClose={closeModal}>
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-fg">
              {editingProposal ? "Edit Proposal" : "New Proposal"}
            </h2>
            <button
              onClick={closeModal}
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              <XIcon
                size={20}
                className="text-fg-secondary"
              />
            </button>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <Input
              label="Title"
              required
              placeholder="e.g. Enterprise Plan Proposal"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
            />

            {editingProposal && (
              <Select
                label="Status"
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
              >
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}

            <Input
              label="Valid Until"
              type="date"
              value={formValidUntil}
              onChange={(e) => setFormValidUntil(e.target.value)}
            />

            <Textarea
              label="Executive Summary"
              placeholder="Provide a brief summary of the proposal..."
              value={formSummary}
              onChange={(e) => setFormSummary(e.target.value)}
              rows={4}
            />

            {/* Pricing Tiers */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-fg">
                Pricing Tiers
              </label>

              {formTiers.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {formTiers.map((tier, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-full border border-line bg-muted text-fg px-2.5 py-1 text-xs font-medium"
                    >
                      {tier.name}: {tier.price}
                      <button
                        type="button"
                        onClick={() => removeTier(i)}
                        className="hover:text-fg"
                      >
                        <XIcon size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  placeholder="Tier name"
                  value={tierName}
                  onChange={(e) => setTierName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTier();
                    }
                  }}
                />
                <Input
                  placeholder="Price"
                  value={tierPrice}
                  onChange={(e) => setTierPrice(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTier();
                    }
                  }}
                />
                <Button
                  variant="outline"
                  onClick={addTier}
                  className="shrink-0"
                >
                  Add
                </Button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending
                ? "Saving..."
                : editingProposal
                  ? "Save Changes"
                  : "Create Proposal"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Proposal"
        itemName={deleteTarget?.title}
        loading={isPending}
      />

      {/* AI Generate Proposal Modal */}
      <AIGenerateModal
        isOpen={aiProposalOpen}
        onClose={() => {
          setAIProposalOpen(false);
          setSelectedDealIdForAI(null);
        }}
        title="AI Generate Proposal"
        description={
          selectedDealIdForAI
            ? `Generating proposal for: ${deals.find((d) => d.id === selectedDealIdForAI)?.name || "Selected deal"}`
            : "Select a deal to generate a proposal"
        }
        onGenerate={async () => {
          const dealId = selectedDealIdForAI;
          if (!dealId) throw new Error("Please select a deal first");
          const result = await aiGenerateProposal(dealId);
          if ("error" in result) throw new Error(result.error);
          return typeof result === "string" ? result : JSON.stringify(result, null, 2);
        }}
        onApply={(content) => {
          // Parse the AI result and populate the create form
          try {
            const parsed = JSON.parse(content);
            setFormTitle(parsed.title || "");
            setFormSummary(parsed.executive_summary || "");
            if (parsed.pricing && Array.isArray(parsed.pricing)) {
              setFormTiers(
                parsed.pricing.map((p: { tier?: string; name?: string; price?: string }) => ({
                  name: p.tier || p.name || "",
                  price: p.price || "",
                }))
              );
            }
          } catch {
            // If parsing fails, just use the title from the content
            setFormTitle("AI Generated Proposal");
            setFormSummary(content);
          }
          setAIProposalOpen(false);
          setSelectedDealIdForAI(null);
          setShowModal(true);
        }}
        editable={true}
        applyLabel="Use Proposal"
      />

      {/* Deal Selector for AI - shown when AI modal opens without a pre-selected deal */}
      {aiProposalOpen && !selectedDealIdForAI && deals.length > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="rounded-lg border border-line bg-surface shadow-modal p-4 w-full max-w-md mx-4 z-[61]" data-clay-box>
            <h3 className="text-sm font-semibold text-fg mb-3">
              Select a Deal
            </h3>
            <p className="text-xs text-fg-secondary mb-4">
              Choose a deal to generate the proposal for
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {deals.map((deal) => (
                <button
                  key={deal.id}
                  onClick={() => setSelectedDealIdForAI(deal.id)}
                  className="w-full text-left px-4 py-3 rounded border border-line hover:bg-muted transition-colors"
                >
                  <p className="text-sm font-medium text-fg">
                    {deal.name}
                  </p>
                  <p className="text-xs text-fg-secondary">
                    {deal.stage} {deal.value ? `\u00B7 $${deal.value.toLocaleString()}` : ""}
                  </p>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setAIProposalOpen(false);
                  setSelectedDealIdForAI(null);
                }}
                className="px-4 py-2 text-sm font-medium text-fg hover:bg-muted rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
