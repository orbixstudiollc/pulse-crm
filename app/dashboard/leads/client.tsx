"use client";

import { useState, useRef, useTransition } from "react";
import {
  Button,
  Badge,
  Avatar,
  Checkbox,
  ActionMenu,
  ExportIcon,
  PlusIcon,
  EyeIcon,
  PencilSimpleIcon,
  TrashIcon,
  UsersThreeIcon,
  CheckCircleIcon,
  SparkleIcon,
  FunnelIcon,
  UploadIcon,
  LightningIcon,
} from "@/components/ui";
import {
  PageHeader,
  FilterBar,
  StatCard,
  TableHeader,
  TableFooter,
  LeadDrawer,
  EmptyState,
} from "@/components/dashboard";
import { AddLeadModal, ScoreBreakdown, AIScoreDrawer, ImportLeadsModal, type LeadFormData } from "@/components/features";
import {
  leadStatusConfig,
  leadStatusOptions,
  leadSourceOptions,
  leadScoreOptions,
  type LeadSource,
} from "@/lib/data/leads";
import { cn, formatCurrency } from "@/lib/utils";
import { createLead, updateLead, deleteLead } from "@/lib/actions/leads";
import { recalculateAllScores } from "@/lib/actions/scoring";
import { aiScoreLead, aiScoreLeadsBatch } from "@/lib/actions/ai-scoring";
import { exportLeadsToCSV } from "@/lib/actions/export";
import { useClickOutside } from "@/hooks";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface LeadRecord {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  website: string | null;
  industry: string | null;
  status: string;
  source: string | null;
  estimated_value: number;
  score: number;
  score_breakdown: unknown;
  win_probability: number;
  days_in_pipeline: number;
  created_at: string;
  [key: string]: unknown;
}

// Map DB record to display shape
function mapLead(l: LeadRecord) {
  return {
    id: l.id,
    name: l.name || "",
    email: l.email || "",
    company: l.company || "",
    phone: l.phone || "",
    linkedin: "",
    location: "",
    employees: "",
    website: l.website || "",
    industry: l.industry || "",
    status: (l.status || "cold") as "hot" | "warm" | "cold",
    source: (l.source || "Website") as LeadSource,
    estimatedValue: l.estimated_value || 0,
    score: l.score || 0,
    scoreBreakdown: l.score_breakdown
      ? typeof l.score_breakdown === "string"
        ? JSON.parse(l.score_breakdown)
        : l.score_breakdown
      : null,
    winProbability: l.win_probability || 0,
    daysInPipeline: l.days_in_pipeline || 0,
    createdDate: l.created_at
      ? new Date(l.created_at).toLocaleDateString()
      : "",
    qualificationData: l.qualification_data ?? null,
    qualificationGrade: (l.qualification_grade as string) ?? null,
    qualificationScore: (l.qualification_score as number) ?? null,
  };
}

export function LeadsPageClient({
  initialLeads,
  initialCount,
}: {
  initialLeads: LeadRecord[];
  initialCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAddLead, setShowAddLead] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState("5");
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<ReturnType<typeof mapLead> | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLead, setEditLead] = useState<ReturnType<typeof mapLead> | null>(null);
  const [scorePopoverId, setScorePopoverId] = useState<string | null>(null);
  const [aiScoreDrawerOpen, setAIScoreDrawerOpen] = useState(false);
  const [aiScoreData, setAIScoreData] = useState<any>(null);
  const [aiScoringLeadId, setAIScoringLeadId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const scorePopoverRef = useRef<HTMLDivElement>(null);

  useClickOutside(scorePopoverRef, () => setScorePopoverId(null), !!scorePopoverId);

  const allLeads = initialLeads.map(mapLead);

  const editLeadFormData = editLead
    ? {
        firstName: editLead.name.split(" ")[0],
        lastName: editLead.name.split(" ").slice(1).join(" "),
        email: editLead.email,
        company: editLead.company,
        phone: editLead.phone,
        source: editLead.source.toLowerCase().replace(" ", "-"),
        value: editLead.estimatedValue.toString(),
        notes: "",
      }
    : undefined;

  // Filter leads
  const filteredLeads = allLeads.filter((lead) => {
    const matchesSearch =
      searchValue === "" ||
      lead.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchValue.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || lead.status === statusFilter;

    const matchesSource =
      sourceFilter === "all" || lead.source === sourceFilter;

    const matchesScore =
      scoreFilter === "all" ||
      (scoreFilter === "high" && lead.score >= 80) ||
      (scoreFilter === "medium" && lead.score >= 60 && lead.score < 80) ||
      (scoreFilter === "low" && lead.score < 60);

    return matchesSearch && matchesStatus && matchesSource && matchesScore;
  });

  const perPage = parseInt(rowsPerPage);
  const totalPages = Math.ceil(filteredLeads.length / perPage);
  const startIndex = (currentPage - 1) * perPage;
  const paginatedLeads = filteredLeads.slice(startIndex, startIndex + perPage);
  const displayStart = startIndex + 1;
  const displayEnd = Math.min(startIndex + perPage, filteredLeads.length);

  const isAllSelected =
    paginatedLeads.length > 0 &&
    paginatedLeads.every((l) => selectedRows.includes(l.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRows((prev) =>
        prev.filter((id) => !paginatedLeads.find((l) => l.id === id)),
      );
    } else {
      const newIds = paginatedLeads.map((l) => l.id);
      setSelectedRows((prev) => [...new Set([...prev, ...newIds])]);
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  };

  const handleFilterChange = (key: string, value: string) => {
    switch (key) {
      case "status":
        setStatusFilter(value);
        break;
      case "source":
        setSourceFilter(value);
        break;
      case "score":
        setScoreFilter(value);
        break;
    }
    setCurrentPage(1);
  };

  const handleAddLead = async (data: LeadFormData) => {
    startTransition(async () => {
      const result = await createLead({
        name: `${data.firstName} ${data.lastName}`.trim(),
        email: data.email,
        company: data.company,
        phone: data.phone,
        source: data.source,
        estimated_value: parseFloat(data.value) || 0,
        status: "warm",
        score: 50,
      });
      if (!result.error) {
        setShowAddLead(false);
        router.refresh();
      }
    });
  };

  const handleEditLead = async (data: LeadFormData) => {
    if (!editLead) return;
    startTransition(async () => {
      const result = await updateLead(editLead.id, {
        name: `${data.firstName} ${data.lastName}`.trim(),
        email: data.email,
        company: data.company,
        phone: data.phone,
        source: data.source,
        estimated_value: parseFloat(data.value) || 0,
      });
      if (!result.error) {
        setShowEditModal(false);
        router.refresh();
      }
    });
  };

  const handleDeleteLead = async (id: string) => {
    startTransition(async () => {
      await deleteLead(id);
      router.refresh();
    });
  };

  const handleRecalculateAll = () => {
    startTransition(async () => {
      const result = await recalculateAllScores();
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Recalculated scores for ${(result as { scored: number }).scored} leads`);
        router.refresh();
      }
    });
  };

  const handleAIScore = async (leadId: string) => {
    setAIScoringLeadId(leadId);
    const result = await aiScoreLead(leadId);
    if ("error" in result) {
      toast.error(result.error);
      setAIScoringLeadId(null);
    } else {
      setAIScoreData(result);
      setAIScoreDrawerOpen(true);
      setAIScoringLeadId(null);
      router.refresh();
    }
  };

  const handleAIScoreAll = async () => {
    const ids = allLeads.map((l) => l.id);
    if (ids.length === 0) return;
    toast.info(`AI scoring ${ids.length} leads...`);
    const { results } = await aiScoreLeadsBatch(ids);
    const successes = results.filter((r) => !("error" in r.result)).length;
    const failures = results.length - successes;
    if (failures > 0) {
      toast.warning(`Scored ${successes} leads, ${failures} failed`);
    } else {
      toast.success(`AI scored ${successes} leads successfully`);
    }
    router.refresh();
  };

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 space-y-4">
      {/* Header */}
      <PageHeader title="Leads">
        <Button
          variant="outline"
          leftIcon={<SparkleIcon size={18} />}
          onClick={handleAIScoreAll}
          disabled={isPending}
        >
          AI Score All
        </Button>
        <Button
          variant="outline"
          leftIcon={<LightningIcon size={18} />}
          onClick={handleRecalculateAll}
          disabled={isPending}
        >
          {isPending ? "Recalculating..." : "Recalculate All"}
        </Button>
        <Button variant="outline" leftIcon={<UploadIcon size={18} />} onClick={() => setShowImport(true)}>
          Import
        </Button>
        <Button
          leftIcon={<PlusIcon size={20} weight="bold" />}
          onClick={() => setShowAddLead(true)}
        >
          Add Lead
        </Button>
      </PageHeader>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Leads"
          value={allLeads.length.toString()}
          change={{ value: "+12%", trend: "up" }}
          icon={
            <UsersThreeIcon
              size={24}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
        <StatCard
          label="Hot Leads"
          value={allLeads.filter((l) => l.status === "hot").length.toString()}
          change={{ value: "+8%", trend: "up" }}
          icon={
            <SparkleIcon
              size={24}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
        <StatCard
          label="Converted"
          value="0"
          change={{ value: "0%", trend: "neutral" }}
          icon={
            <CheckCircleIcon
              size={24}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
      </div>

      {/* Filters */}
      <FilterBar
        searchPlaceholder="Search leads..."
        onSearchChange={(value) => {
          setSearchValue(value);
          setCurrentPage(1);
        }}
        filters={[
          {
            key: "status",
            label: "Status",
            options: leadStatusOptions,
          },
          {
            key: "source",
            label: "Source",
            options: leadSourceOptions,
          },
          {
            key: "score",
            label: "Score",
            options: leadScoreOptions,
          },
        ]}
        onFilterChange={handleFilterChange}
      />

      {/* Leads Table */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
        {/* Bulk Actions */}
        {selectedRows.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
            <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
              {selectedRows.length} item{selectedRows.length > 1 ? "s" : ""}{" "}
              selected
            </span>
            <div className="flex items-center gap-4">
              <button className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors">
                Email
              </button>
              <button
                onClick={async () => {
                  const result = await exportLeadsToCSV();
                  if (result.error) { toast.error(result.error); return; }
                  const blob = new Blob([result.csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click(); URL.revokeObjectURL(url);
                  toast.success("Leads exported successfully");
                }}
                className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors"
              >
                Export
              </button>
              <button className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors">
                Delete
              </button>
              <button
                onClick={() => setSelectedRows([])}
                className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors"
              >
                Clear selection
              </button>
            </div>
          </div>
        )}

        {/* Table Header */}
        <TableHeader
          title="All Leads"
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(value) => {
            setRowsPerPage(value);
            setCurrentPage(1);
          }}
        />

        {/* Table or Empty State */}
        {filteredLeads.length > 0 ? (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-[0.5px] border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
                    <th className="w-12 px-5 py-3">
                      <Checkbox
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                      Lead
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                      Status
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                      Source
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                      Est. Value
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                      Score
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                      Grade
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                      Created
                    </th>
                    <th className="text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 px-3 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => {
                        setSelectedLead(lead);
                        setDrawerOpen(true);
                      }}
                      className="border-b-[0.5px] border-neutral-200 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer"
                    >
                      <td
                        className="w-12 px-5 py-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={selectedRows.includes(lead.id)}
                          onChange={() => toggleSelectRow(lead.id)}
                        />
                      </td>
                      <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        <div className="flex items-center gap-3">
                          <Avatar name={lead.name} />
                          <div>
                            <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                              {lead.name}
                            </p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                              {lead.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        <Badge
                          variant={
                            leadStatusConfig[lead.status as keyof typeof leadStatusConfig]
                              ?.variant ?? "neutral"
                          }
                          dot
                        >
                          {leadStatusConfig[lead.status as keyof typeof leadStatusConfig]
                            ?.label ?? lead.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">
                          {lead.source}
                        </span>
                      </td>
                      <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                          {formatCurrency(lead.estimatedValue)}
                        </span>
                      </td>
                      <td
                        className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="relative">
                          <button
                            onClick={() =>
                              setScorePopoverId(
                                scorePopoverId === lead.id ? null : lead.id,
                              )
                            }
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-full border-[0.5px] text-sm font-semibold cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-neutral-300 dark:hover:ring-neutral-600 transition-all",
                              lead.score >= 75
                                ? "border-green-200 dark:border-green-400/30 bg-green-100 text-green-600 dark:bg-green-400/15 dark:text-green-400"
                                : lead.score >= 50
                                  ? "border-amber-200 dark:border-amber-400/30 bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400"
                                  : "border-red-200 dark:border-red-400/30 bg-red-100 text-red-600 dark:bg-red-400/15 dark:text-red-400",
                            )}
                          >
                            {lead.score}
                          </button>
                          {scorePopoverId === lead.id && (
                            <div
                              ref={scorePopoverRef}
                              className="absolute left-0 top-full mt-2 w-72 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-lg p-4 z-50"
                            >
                              <ScoreBreakdown
                                breakdown={lead.scoreBreakdown}
                                compact
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        {lead.qualificationGrade ? (
                          <span
                            className={cn(
                              "inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold",
                              lead.qualificationGrade === "A"
                                ? "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-400/15 border-green-200 dark:border-green-400/30"
                                : lead.qualificationGrade === "B"
                                  ? "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-400/15 border-blue-200 dark:border-blue-400/30"
                                  : lead.qualificationGrade === "C"
                                    ? "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-400/15 border-amber-200 dark:border-amber-400/30"
                                    : "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-400/15 border-red-200 dark:border-red-400/30",
                            )}
                          >
                            {lead.qualificationGrade}
                          </span>
                        ) : (
                          <span className="text-sm text-neutral-400 dark:text-neutral-500">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        <span className="text-sm text-neutral-500 dark:text-neutral-400">
                          {lead.createdDate}
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
                                onClick: () => {
                                  setSelectedLead(lead);
                                  setDrawerOpen(true);
                                },
                              },
                              {
                                label: "Edit Lead",
                                icon: <PencilSimpleIcon size={18} />,
                                onClick: () => {
                                  setEditLead(lead);
                                  setShowEditModal(true);
                                },
                              },
                              {
                                label: aiScoringLeadId === lead.id ? "Scoring..." : "AI Score",
                                icon: <SparkleIcon size={18} />,
                                onClick: () => handleAIScore(lead.id),
                              },
                              {
                                label: "Delete Lead",
                                icon: <TrashIcon size={18} />,
                                onClick: () => handleDeleteLead(lead.id),
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

            {/* Table Footer with Pagination */}
            <TableFooter
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredLeads.length}
              startIndex={displayStart}
              endIndex={displayEnd}
              onPageChange={setCurrentPage}
              itemLabel="leads"
            />
          </>
        ) : (
          <EmptyState
            icon={<FunnelIcon size={24} />}
            title={
              searchValue ||
              statusFilter !== "all" ||
              sourceFilter !== "all" ||
              scoreFilter !== "all"
                ? "No leads found"
                : "No leads yet"
            }
            description={
              searchValue ||
              statusFilter !== "all" ||
              sourceFilter !== "all" ||
              scoreFilter !== "all"
                ? "Try adjusting your search or filters to find what you're looking for."
                : "Start building your pipeline by importing leads or adding your first one manually."
            }
            actions={
              searchValue ||
              statusFilter !== "all" ||
              sourceFilter !== "all" ||
              scoreFilter !== "all"
                ? [
                    {
                      label: "Clear Filters",
                      variant: "outline",
                      onClick: () => {
                        setSearchValue("");
                        setStatusFilter("all");
                        setSourceFilter("all");
                        setScoreFilter("all");
                      },
                    },
                  ]
                : [
                    {
                      label: "Import Leads",
                      icon: <UploadIcon size={18} />,
                      variant: "outline",
                      onClick: () => setShowImport(true),
                    },
                    {
                      label: "Add Lead",
                      icon: <PlusIcon size={18} weight="bold" />,
                      variant: "primary",
                      onClick: () => setShowAddLead(true),
                    },
                  ]
            }
          />
        )}
      </div>

      {/* Add Lead Modal */}
      <AddLeadModal
        open={showAddLead}
        onClose={() => setShowAddLead(false)}
        onSubmit={handleAddLead}
      />

      {/* Lead Details Drawer */}
      <LeadDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        lead={selectedLead}
        onEdit={() => {
          setEditLead(selectedLead);
          setShowEditModal(true);
        }}
      />

      {/* Edit Lead Modal */}
      <AddLeadModal
        key={showEditModal ? `edit-${editLead?.id}` : "closed"}
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        mode="edit"
        initialData={editLeadFormData}
        onSubmit={handleEditLead}
      />

      {/* AI Score Drawer */}
      <AIScoreDrawer
        isOpen={aiScoreDrawerOpen}
        onClose={() => {
          setAIScoreDrawerOpen(false);
          setAIScoreData(null);
          setAIScoringLeadId(null);
        }}
        leadId={aiScoringLeadId || ""}
        leadName={allLeads.find((l) => l.id === aiScoringLeadId)?.name || "Lead"}
        onScoreApplied={() => router.refresh()}
      />

      {/* Import Leads Modal */}
      <ImportLeadsModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImportComplete={() => router.refresh()}
      />
    </div>
  );
}
