"use client";

import { useState } from "react";
import {
  Avatar,
  Badge,
  Checkbox,
  Dropdown,
  Progress,
  ActionMenu,
  EyeIcon,
  PencilSimpleIcon,
  EnvelopeIcon,
  TrashIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from "@/components/ui";
import { CustomerDrawer } from "./CustomerDrawer";
import { cn } from "@/lib/utils";
import { customers as defaultCustomers, Customer } from "@/lib/data/customers";

type CustomerStatus = "active" | "pending" | "inactive";
type CustomerPlan = "enterprise" | "pro" | "starter";

interface CustomersTableProps {
  customers?: Customer[];
  totalCustomers?: number;
  className?: string;
}

const statusConfig: Record<
  CustomerStatus,
  { label: string; variant: "green" | "amber" | "neutral" }
> = {
  active: { label: "Active", variant: "green" },
  pending: { label: "Pending", variant: "amber" },
  inactive: { label: "Inactive", variant: "neutral" },
};

const planConfig: Record<
  CustomerPlan,
  { label: string; variant: "violet" | "blue" | "neutral" }
> = {
  enterprise: { label: "Enterprise", variant: "violet" },
  pro: { label: "Pro", variant: "blue" },
  starter: { label: "Starter", variant: "neutral" },
};

const rowsPerPageOptions = [
  { label: "5", value: "5" },
  { label: "10", value: "10" },
  { label: "25", value: "25" },
  { label: "50", value: "50" },
];

function formatMRR(value: number) {
  return `$${value.toLocaleString()}`;
}

export function CustomersTable({
  customers = defaultCustomers,
  totalCustomers = 284,
  className,
}: CustomersTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState("5");
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );

  const perPage = parseInt(rowsPerPage);
  const totalPages = Math.ceil(totalCustomers / perPage);
  const startIndex = (currentPage - 1) * perPage + 1;
  const endIndex = Math.min(currentPage * perPage, totalCustomers);

  const toggleSelectAll = () => {
    if (selectedRows.length === customers.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(customers.map((c) => c.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  };

  const handleViewDetails = (customer: Customer) => {
    setSelectedCustomer({
      ...customer,
      monthlyRevenue: customer.mrr,
      healthScore: customer.health,
      lifetimeValue: customer.lifetimeValue || 0,
      tenure: customer.tenure || 0,
      company: customer.company || "",
      industry: customer.industry || "",
      phone: customer.phone || "",
      location: customer.location || "",
    });
    setDrawerOpen(true);
  };

  const isAllSelected = selectedRows.length === customers.length;

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      for (
        let i = Math.max(2, currentPage - 1);
        i <= Math.min(totalPages - 1, currentPage + 1);
        i++
      ) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden",
        className,
      )}
    >
      {/* Bulk Actions Bar */}
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
              Edit
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

      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-neutral-800">
        <h3 className="text-lg font-serif text-neutral-950 dark:text-neutral-50">
          All Customers
        </h3>

        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            Show
          </span>
          <Dropdown
            options={rowsPerPageOptions}
            value={rowsPerPage}
            onChange={(value) => {
              setRowsPerPage(value);
              setCurrentPage(1);
            }}
            icon={null}
            size="md"
          />
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            rows
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-[0.5px] border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
              {/* Checkbox */}
              <th className="w-12 px-5 py-3">
                <Checkbox checked={isAllSelected} onChange={toggleSelectAll} />
              </th>
              <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                Customer
              </th>
              <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                Status
              </th>
              <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                Plan
              </th>
              <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                MRR
              </th>
              <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                Health
              </th>
              <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                Last Contact
              </th>
              <th className="text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 px-3 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr
                key={customer.id}
                onClick={() => handleViewDetails(customer)}
                className="border-b-[0.5px] border-neutral-200 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer"
              >
                {/* Checkbox */}
                <td
                  className="w-12 px-5 py-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={selectedRows.includes(customer.id)}
                    onChange={() => toggleSelectRow(customer.id)}
                  />
                </td>

                {/* Customer */}
                <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={customer.avatar}
                      name={customer.name}
                      size="lg"
                    />
                    <div>
                      <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                        {customer.name}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {customer.email}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Status */}
                <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                  <Badge variant={statusConfig[customer.status].variant}>
                    {statusConfig[customer.status].label}
                  </Badge>
                </td>

                {/* Plan */}
                <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                  <Badge variant={planConfig[customer.plan].variant}>
                    {planConfig[customer.plan].label}
                  </Badge>
                </td>

                {/* MRR */}
                <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                  <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                    {formatMRR(customer.mrr)}
                  </span>
                </td>

                {/* Health */}
                <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center gap-3">
                    <Progress
                      value={customer.healthScore}
                      color="auto"
                      className="w-16"
                    />
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">
                      {customer.healthScore}
                    </span>
                  </div>
                </td>

                {/* Last Contact */}
                <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">
                    {customer.lastContact}
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
                          onClick: () => handleViewDetails(customer),
                        },
                        {
                          label: "Edit Customer",
                          icon: <PencilSimpleIcon size={18} />,
                          href: `/dashboard/customers/${customer.id}/edit`,
                        },
                        {
                          label: "Delete Customer",
                          icon: <TrashIcon size={18} />,
                          onClick: () => console.log("Delete", customer.id),
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

      {/* Pagination */}
      <div className="flex items-center justify-between px-5 py-4 border-t border-neutral-200 dark:border-neutral-800">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Showing{" "}
          <span className="font-medium text-neutral-950 dark:text-neutral-50">
            {startIndex}–{endIndex}
          </span>{" "}
          of{" "}
          <span className="font-medium text-neutral-950 dark:text-neutral-50">
            {totalCustomers}
          </span>{" "}
          customers
        </p>

        <div className="flex items-center gap-1">
          {/* Previous */}
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            <CaretLeftIcon
              size={16}
              className="text-neutral-600 dark:text-neutral-400"
            />
          </button>

          {/* Page Numbers */}
          {getPageNumbers().map((page, index) =>
            page === "..." ? (
              <span
                key={`ellipsis-${index}`}
                className="flex h-9 w-9 items-center justify-center text-sm text-neutral-500"
              >
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => setCurrentPage(page as number)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors",
                  currentPage === page
                    ? "bg-neutral-950 dark:bg-neutral-50 text-white dark:text-neutral-950"
                    : "border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800",
                )}
              >
                {page}
              </button>
            ),
          )}

          {/* Next */}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            <CaretRightIcon
              size={16}
              className="text-neutral-600 dark:text-neutral-400"
            />
          </button>
        </div>
      </div>

      {/* Customer Details Drawer */}
      <CustomerDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        customer={
          selectedCustomer
            ? {
                id: selectedCustomer.id,
                name: selectedCustomer.name,
                email: selectedCustomer.email,
                avatar: selectedCustomer.avatar,
                monthlyRevenue: selectedCustomer.mrr,
                healthScore: selectedCustomer.healthScore,
                lifetimeValue: selectedCustomer.lifetimeValue || 0,
                tenure: selectedCustomer.tenure || 0,
                status: selectedCustomer.status,
                plan: selectedCustomer.plan,
                company: selectedCustomer.company || "",
                industry: selectedCustomer.industry || "",
                phone: selectedCustomer.phone || "",
                location: selectedCustomer.location || "",
              }
            : null
        }
      />
    </div>
  );
}
