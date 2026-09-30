"use client";

import { useState, useRef, useTransition, useEffect } from "react";
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
  PaperPlaneTiltIcon,
} from "@/components/ui";
import {
  Page,
  PageHeader,
  MetricStrip,
  TableSection,
  FilterBar,
  StatCard,
  TableHeader,
  TableFooter,
  LeadDrawer,
  EmptyState,
  ConfirmModal,
} from "@/components/dashboard";
import { AddLeadModal, ScoreBreakdown, AIScoreDrawer, ImportLeadsModal, SequencePickerModal, type LeadFormData } from "@/components/features";
import {
  leadStatusConfig,
  leadStatusOptions,
  leadSourceOptions,
  leadScoreOptions,
  type LeadSource,
} from "@/lib/data/leads";
import { cn, formatCurrency } from "@/lib/utils";
import { createLead, updateLead, deleteLead, getLeadsAsJson } from "@/lib/actions/leads";
import { recalculateAllScores } from "@/lib/actions/scoring";
import { aiScoreLead, aiScoreLeadsBatch } from "@/lib/actions/ai-scoring";
import { exportLeadsToCSV } from "@/lib/actions/export";
import { useClickOutside } from "@/hooks";
// useRouter removed — data refresh via fetchLeads()
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { countInMonth, monthOverMonth } from "@/lib/stats/period-delta";

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

function monthChange(dates: (string | null | undefined)[]) {
  const delta = monthOverMonth(countInMonth(dates, 0), countInMonth(dates, -1));
  return delta ? { value: delta.text, trend: delta.trend } : undefined;
}

// Map DB record to display shape
function mapLead(l: LeadRecord) {
  return {
    id: l.id,
    name: l.name || "",
    email: l.email || "",
    company: l.company || "",
    phone: l.phone || "",
    title: (l.title as string) || "",
    linkedin: (l.linkedin as string) || "",
    twitter: (l.twitter as string) || "",
    facebook: (l.facebook as string) || "",
    instagram: (l.instagram as string) || "",
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
    // Personalization fields
    painPoints: (l.pain_points as string) || "",
    triggerEvent: (l.trigger_event as string) || "",
    timezone: (l.timezone as string) || "",
    preferredLanguage: (l.preferred_language as string) || "",
    lastContactedAt: (l.last_contacted_at as string) || "",
    tags: Array.isArray(l.tags) ? l.tags as string[] : [],
    revenueRange: (l.revenue_range as string) || "",
    techStack: (l.tech_stack as string) || "",
    fundingStage: (l.funding_stage as string) || "",
    decisionRole: (l.decision_role as string) || "",
    currentSolution: (l.current_solution as string) || "",
    referredBy: (l.referred_by as string) || "",
    personalNote: (l.personal_note as string) || "",
    birthday: (l.birthday as string) || "",
    contentInterests: Array.isArray(l.content_interests) ? l.content_interests as string[] : [],
    meetingPreference: (l.meeting_preference as string) || "",
    assistantName: (l.assistant_name as string) || "",
    assistantEmail: (l.assistant_email as string) || "",
  };
}

export function LeadsPageClient() {
  const [leadsData, setLeadsData] = useState<LeadRecord[]>([]);
  const [leadsCount, setLeadsCount] = useState(0);
  const [leadsLoading, setLeadsLoading] = useState(true);

  const fetchLeads = async () => {
    try {
      const { json, count } = await getLeadsAsJson({ perPage: 100 });
      setLeadsData(JSON.parse(json) ?? []);
      setLeadsCount(count);
    } catch (e) {
      console.error("Failed to fetch leads:", e);
    } finally {
      setLeadsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);
  const [isPending, startTransition] = useTransition();
  const [showAddLead, setShowAddLead] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState("5");
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "single" | "bulk"; id?: string } | null>(null);
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
  const [aiScoreData, setAIScoreData] = useState<unknown>(null);
  const [aiScoringLeadId, setAIScoringLeadId] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const importParamHandled = useRef(false);
  const [showImport, setShowImport] = useState(
    () => searchParams.get("import") === "1",
  );

  // Deep link from Overview's "Import data" card: /dashboard/leads?import=1.
  // The modal opens via the initial state above; drop the param once so a
  // refresh does not reopen it.
  useEffect(() => {
    if (importParamHandled.current || searchParams.get("import") !== "1") return;
    importParamHandled.current = true;
    router.replace("/dashboard/leads");
  }, [searchParams, router]);
  const [showSequencePicker, setShowSequencePicker] = useState(false);
  const scorePopoverRef = useRef<HTMLDivElement>(null);

  useClickOutside(scorePopoverRef, () => setScorePopoverId(null), !!scorePopoverId);

  const allLeads = leadsData.map(mapLead);

  const editLeadFormData = editLead
    ? {
        firstName: editLead.name.split(" ")[0],
        lastName: editLead.name.split(" ").slice(1).join(" "),
        email: editLead.email,
        company: editLead.company,
        title: editLead.title || "",
        phone: editLead.phone,
        website: editLead.website || "",
        linkedin: editLead.linkedin || "",
        twitter: editLead.twitter || "",
        source: editLead.source.toLowerCase().replace(" ", "-"),
        value: editLead.estimatedValue.toString(),
        notes: "",
        painPoints: editLead.painPoints || "",
        triggerEvent: editLead.triggerEvent || "",
        personalNote: editLead.personalNote || "",
        referredBy: editLead.referredBy || "",
        revenueRange: editLead.revenueRange || "",
        techStack: editLead.techStack || "",
        fundingStage: editLead.fundingStage || "",
        currentSolution: editLead.currentSolution || "",
        decisionRole: editLead.decisionRole || "",
        timezone: editLead.timezone || "",
        preferredLanguage: editLead.preferredLanguage || "",
        meetingPreference: editLead.meetingPreference || "",
        tags: Array.isArray(editLead.tags) ? editLead.tags.join(", ") : "",
        birthday: editLead.birthday || "",
        contentInterests: Array.isArray(editLead.contentInterests) ? editLead.contentInterests.join(", ") : "",
        assistantName: editLead.assistantName || "",
        assistantEmail: editLead.assistantEmail || "",
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
        title: data.title || null,
        phone: data.phone,
        website: data.website || null,
        linkedin: data.linkedin || null,
        twitter: data.twitter || null,
        source: data.source,
        estimated_value: parseFloat(data.value) || 0,
        status: "warm",
        score: 50,
        pain_points: data.painPoints || null,
        trigger_event: data.triggerEvent || null,
        personal_note: data.personalNote || null,
        referred_by: data.referredBy || null,
        revenue_range: data.revenueRange || null,
        tech_stack: data.techStack || null,
        funding_stage: data.fundingStage || null,
        current_solution: data.currentSolution || null,
        decision_role: data.decisionRole || null,
        timezone: data.timezone || null,
        preferred_language: data.preferredLanguage || null,
        meeting_preference: data.meetingPreference || null,
        tags: data.tags ? data.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
        birthday: data.birthday || null,
        content_interests: data.contentInterests ? data.contentInterests.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
        assistant_name: data.assistantName || null,
        assistant_email: data.assistantEmail || null,
      });
      if (!result.error) {
        setShowAddLead(false);
        fetchLeads();
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
        title: data.title || null,
        phone: data.phone,
        website: data.website || null,
        linkedin: data.linkedin || null,
        twitter: data.twitter || null,
        source: data.source,
        estimated_value: parseFloat(data.value) || 0,
        pain_points: data.painPoints || null,
        trigger_event: data.triggerEvent || null,
        personal_note: data.personalNote || null,
        referred_by: data.referredBy || null,
        revenue_range: data.revenueRange || null,
        tech_stack: data.techStack || null,
        funding_stage: data.fundingStage || null,
        current_solution: data.currentSolution || null,
        decision_role: data.decisionRole || null,
        timezone: data.timezone || null,
        preferred_language: data.preferredLanguage || null,
        meeting_preference: data.meetingPreference || null,
        tags: data.tags ? data.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
        birthday: data.birthday || null,
        content_interests: data.contentInterests ? data.contentInterests.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
        assistant_name: data.assistantName || null,
        assistant_email: data.assistantEmail || null,
      });
      if (!result.error) {
        setShowEditModal(false);
        fetchLeads();
      }
    });
  };

  const handleDeleteLead = async (id: string) => {
    setConfirmDelete({ type: "single", id });
  };

  const executeDeleteConfirmed = () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === "single" && confirmDelete.id) {
      const id = confirmDelete.id;
      setConfirmDelete(null);
      startTransition(async () => {
        const result = await deleteLead(id);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Lead deleted");
          fetchLeads();
        }
      });
    } else if (confirmDelete.type === "bulk") {
      const ids = [...selectedRows];
      setConfirmDelete(null);
      startTransition(async () => {
        let deleted = 0;
        for (const id of ids) {
          const result = await deleteLead(id);
          if (!result.error) deleted++;
        }
        setSelectedRows([]);
        fetchLeads();
        toast.success(`Deleted ${deleted} lead${deleted !== 1 ? "s" : ""}`);
      });
    }
  };

  const handleRecalculateAll = () => {
    startTransition(async () => {
      const result = await recalculateAllScores();
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Recalculated scores for ${(result as { scored: number }).scored} leads`);
        fetchLeads();
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
      fetchLeads();
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
    fetchLeads();
  };

  return (
    <Page>
      {/* Header */}
      <PageHeader title="Leads" icon={<FunnelIcon size={18} />}>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="whitespace-nowrap"
            leftIcon={<SparkleIcon size={18} />}
            onClick={handleAIScoreAll}
            disabled={isPending}
          >
            AI Score All
          </Button>
          <Button
            variant="outline"
            className="whitespace-nowrap"
            leftIcon={<LightningIcon size={18} />}
            onClick={handleRecalculateAll}
            disabled={isPending}
          >
            {isPending ? "Recalculating..." : "Recalculate All"}
          </Button>
          <Button variant="outline" className="whitespace-nowrap" leftIcon={<UploadIcon size={18} />} onClick={() => setShowImport(true)}>
            Import
          </Button>
          <Button
            variant="outline"
            className="whitespace-nowrap"
            leftIcon={<ExportIcon size={18} />}
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
          >
            Export
          </Button>
          <Button
            className="whitespace-nowrap"
            leftIcon={<PlusIcon size={20} weight="bold" />}
            onClick={() => setShowAddLead(true)}
          >
            Add Lead
          </Button>
        </div>
      </PageHeader>

      {/* Metrics */}
      <MetricStrip>
        <StatCard
          label="Total Leads"
          value={allLeads.length.toString()}
          change={monthChange(leadsData.map((l) => l.created_at))}
          icon={
            <UsersThreeIcon
              size={24}
              className="text-fg"
            />
          }
        />
        <StatCard
          label="Hot Leads"
          value={allLeads.filter((l) => l.status === "hot").length.toString()}
          change={monthChange(leadsData.filter((l) => (l.status || "cold") === "hot").map((l) => l.created_at))}
          icon={
            <SparkleIcon
              size={24}
              className="text-fg"
            />
          }
        />
        <StatCard
          label="Converted"
          value="0"
          icon={
            <CheckCircleIcon
              size={24}
              className="text-fg"
            />
          }
        />
      </MetricStrip>

      {/* Table heading row */}
      <TableHeader
        title="All Leads"
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(value) => {
          setRowsPerPage(value);
          setCurrentPage(1);
        }}
      />

      {/* Filter row */}
      <FilterBar
        className="px-8 max-sm:px-4 border-t border-divider"
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

      {/* Bulk Actions */}
      {selectedRows.length > 0 && (
        <div className="flex h-10 items-center justify-between gap-4 px-8 max-sm:px-4 border-t border-divider">
          <span className="text-[13px] font-medium text-fg">
            {selectedRows.length} item{selectedRows.length > 1 ? "s" : ""}{" "}
            selected
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const selected = filteredLeads.filter((l) => selectedRows.includes(l.id));
                const emails = selected.map((l) => l.email).filter(Boolean).join(",");
                if (emails) {
                  window.location.href = `mailto:${emails}`;
                } else {
                  toast.error("No email addresses found for selected leads");
                }
              }}
              className="text-[13px] text-fg-secondary hover:text-fg transition-colors"
            >
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
              className="text-[13px] text-fg-secondary hover:text-fg transition-colors"
            >
              Export
            </button>
            <button
              onClick={() => setShowSequencePicker(true)}
              className="text-[13px] text-fg-secondary hover:text-fg transition-colors"
            >
              Add to Sequence
            </button>
            <button
              onClick={() => setConfirmDelete({ type: "bulk" })}
              className="text-[13px] text-danger hover:opacity-80 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => setSelectedRows([])}
              className="text-[13px] text-fg-secondary hover:text-fg transition-colors"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {/* Table, Loading Skeleton, or Empty State */}
      {leadsLoading ? (
        <div className="border-t border-divider">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex h-11 items-center gap-3 px-8 max-sm:px-4 border-b border-divider">
              <div className="h-4 w-4 animate-pulse rounded bg-active" />
              <div className="h-4 w-40 animate-pulse rounded bg-active" />
              <div className="h-4 w-32 animate-pulse rounded bg-active max-sm:hidden" />
              <div className="ml-auto h-4 w-16 animate-pulse rounded bg-active" />
            </div>
          ))}
        </div>
      ) : filteredLeads.length > 0 ? (
        <>
          <TableSection>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="w-10">
                      <Checkbox
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="text-left text-[13px] font-medium text-fg-secondary">
                      Lead
                    </th>
                    <th className="text-left text-[13px] font-medium text-fg-secondary">
                      Status
                    </th>
                    <th className="text-left text-[13px] font-medium text-fg-secondary">
                      Source
                    </th>
                    <th className="text-left text-[13px] font-medium text-fg-secondary">
                      Est. Value
                    </th>
                    <th className="text-left text-[13px] font-medium text-fg-secondary">
                      Score
                    </th>
                    <th className="text-left text-[13px] font-medium text-fg-secondary">
                      Grade
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
                  {paginatedLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => {
                        setSelectedLead(lead);
                        setDrawerOpen(true);
                      }}
                      className="hover:bg-subtle transition-colors cursor-pointer"
                    >
                      <td
                        className="w-10 py-2 text-[14px] text-fg"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={selectedRows.includes(lead.id)}
                          onChange={() => toggleSelectRow(lead.id)}
                        />
                      </td>
                      <td className="py-2 text-[14px] text-fg">
                        <div className="flex items-center gap-3">
                          <Avatar name={lead.name} />
                          <div>
                            <p className="text-[14px] font-medium text-fg">
                              {lead.name}
                            </p>
                            <p className="text-xs text-fg-secondary">
                              {lead.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 text-[14px] text-fg">
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
                      <td className="py-2 text-[14px] text-fg">
                        <span className="text-[13px] text-fg-secondary">
                          {lead.source}
                        </span>
                      </td>
                      <td className="py-2 text-[14px] text-fg">
                        <span className="text-[14px] font-medium text-fg">
                          {formatCurrency(lead.estimatedValue)}
                        </span>
                      </td>
                      <td
                        className="py-2 text-[14px] text-fg"
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
                              "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-fg-muted transition-all",
                              lead.score >= 75
                                ? "border-success bg-success-surface text-success"
                                : lead.score >= 50
                                  ? "border-warning bg-warning-surface text-warning"
                                  : "border-danger bg-danger-surface text-danger",
                            )}
                          >
                            {lead.score}
                          </button>
                          {scorePopoverId === lead.id && (
                            <div
                              ref={scorePopoverRef}
                              className="absolute left-0 top-full mt-2 w-72 rounded-lg border border-line bg-surface shadow-dropdown p-4 z-50" data-clay-box
                            >
                              <ScoreBreakdown
                                breakdown={lead.scoreBreakdown}
                                compact
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2 text-[14px] text-fg">
                        {lead.qualificationGrade ? (
                          <span
                            className={cn(
                              "inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
                              lead.qualificationGrade === "A"
                                ? "text-success bg-success-surface border-success"
                                : lead.qualificationGrade === "B"
                                  ? "text-accent-on-surface bg-accent-surface border-accent"
                                  : lead.qualificationGrade === "C"
                                    ? "text-warning bg-warning-surface border-warning"
                                    : "text-danger bg-danger-surface border-danger",
                            )}
                          >
                            {lead.qualificationGrade}
                          </span>
                        ) : (
                          <span className="text-[13px] text-fg-muted">—</span>
                        )}
                      </td>
                      <td className="py-2 text-[14px] text-fg">
                        <span className="text-[13px] text-fg-secondary">
                          {lead.createdDate}
                        </span>
                      </td>
                      <td
                        className="py-2 text-[14px] text-fg"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end">
                          <ActionMenu
                            className="h-6 w-6"
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
          </TableSection>

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
        onScoreApplied={() => fetchLeads()}
      />

      {/* Import Leads Modal */}
      <ImportLeadsModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImportComplete={() => fetchLeads()}
      />
      <SequencePickerModal
        open={showSequencePicker}
        onClose={() => setShowSequencePicker(false)}
        leadIds={selectedRows}
        onComplete={() => {
          setSelectedRows([]);
        }}
      />
      <ConfirmModal
        open={!!confirmDelete}
        title="Delete Lead"
        message={
          confirmDelete?.type === "bulk"
            ? `Delete ${selectedRows.length} lead${selectedRows.length !== 1 ? "s" : ""}? This cannot be undone.`
            : "Delete this lead? This cannot be undone."
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={executeDeleteConfirmed}
        onCancel={() => setConfirmDelete(null)}
      />
    </Page>
  );
}
