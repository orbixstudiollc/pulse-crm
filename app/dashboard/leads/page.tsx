"use client";

import { useState } from "react";
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
import { AddLeadModal } from "@/components/features";
import {
  leads as allLeads,
  leadStatusConfig,
  leadStatusOptions,
  leadSourceOptions,
  leadScoreOptions,
  getLeadScoreStyle,
  type Lead,
} from "@/lib/data/leads";
import { cn, formatCurrency } from "@/lib/utils";

export default function LeadsPage() {
  const [showAddLead, setShowAddLead] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState("5");
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);

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

  return (
    <div className="py-6 px-8 space-y-4">
      {/* Header */}
      <PageHeader title="Leads">
        <Button variant="outline" leftIcon={<ExportIcon size={18} />}>
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
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Total Leads"
          value={filteredLeads.length.toString()}
          change={{ value: "+12%", trend: "up" }}
          icon={
            <UsersThreeIcon
              size={24}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
        <StatCard
          label="New This Week"
          value="64"
          change={{ value: "+8%", trend: "up" }}
          icon={
            <SparkleIcon
              size={24}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
        <StatCard
          label="Conversion Rate"
          value="24%"
          change={{ value: "+3%", trend: "up" }}
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
              <button className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors">
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
                      {/* Checkbox */}
                      <td
                        className="w-12 px-5 py-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={selectedRows.includes(lead.id)}
                          onChange={() => toggleSelectRow(lead.id)}
                        />
                      </td>
                      {/* Lead */}
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
                      {/* Status */}
                      <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        <Badge
                          variant={leadStatusConfig[lead.status].variant}
                          dot
                        >
                          {leadStatusConfig[lead.status].label}
                        </Badge>
                      </td>
                      {/* Source */}
                      <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">
                          {lead.source}
                        </span>
                      </td>
                      {/* Est. Value */}
                      <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                          {formatCurrency(lead.estimatedValue)}
                        </span>
                      </td>
                      {/* Score */}
                      <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        <div
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-full border-[0.5px] text-sm font-semibold",
                            getLeadScoreStyle(lead.score),
                          )}
                        >
                          {lead.score}
                        </div>
                      </td>
                      {/* Created */}
                      <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        <span className="text-sm text-neutral-500 dark:text-neutral-400">
                          {lead.createdDate}
                        </span>
                      </td>
                      {/* Actions */}
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
                                label: "Delete Lead",
                                icon: <TrashIcon size={18} />,
                                onClick: () => {},
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
        onSubmit={(data) => {
          console.log("New lead:", data);
        }}
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
        onSubmit={(data) => {
          console.log("Updated lead:", data);
        }}
      />
    </div>
  );
}
