"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Badge,
  Checkbox,
  Dropdown,
  DotsThreeVerticalIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from "@/components/ui";
import { cn } from "@/lib/utils";

type CustomerStatus = "active" | "pending" | "inactive";
type CustomerPlan = "enterprise" | "pro" | "starter";

interface Customer {
  id: string;
  name: string;
  email: string;
  avatar: string;
  status: CustomerStatus;
  plan: CustomerPlan;
  mrr: number;
  health: number;
  lastContact: string;
}

interface CustomersTableProps {
  customers?: Customer[];
  totalCustomers?: number;
  className?: string;
}

const defaultCustomers: Customer[] = [
  {
    id: "1",
    name: "James Anderson",
    email: "j.anderson@nextgen.io",
    avatar: "/images/avatars/avatar-1.jpg",
    status: "active",
    plan: "enterprise",
    mrr: 2450,
    health: 92,
    lastContact: "2 hours ago",
  },
  {
    id: "2",
    name: "Sarah Johnson",
    email: "sarah.johnson@acme.com",
    avatar: "/images/avatars/avatar-2.jpg",
    status: "active",
    plan: "pro",
    mrr: 149,
    health: 85,
    lastContact: "5 hours ago",
  },
  {
    id: "3",
    name: "Jennifer Walsh",
    email: "j.walsh@globaltech.com",
    avatar: "/images/avatars/avatar-3.jpg",
    status: "pending",
    plan: "enterprise",
    mrr: 4200,
    health: 68,
    lastContact: "1 day ago",
  },
  {
    id: "4",
    name: "David Kim",
    email: "david.kim@innovate.co",
    avatar: "/images/avatars/avatar-4.jpg",
    status: "active",
    plan: "pro",
    mrr: 299,
    health: 94,
    lastContact: "3 hours ago",
  },
  {
    id: "5",
    name: "Emily Johnson",
    email: "emily@designstudio.com",
    avatar: "/images/avatars/avatar-5.jpg",
    status: "inactive",
    plan: "starter",
    mrr: 49,
    health: 32,
    lastContact: "2 weeks ago",
  },
  {
    id: "6",
    name: "Robert Patel",
    email: "r.patel@financeplus.com",
    avatar: "/images/avatars/avatar-6.jpg",
    status: "active",
    plan: "enterprise",
    mrr: 8500,
    health: 88,
    lastContact: "1 hour ago",
  },
];

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

function getHealthColor(health: number) {
  if (health >= 80) return "bg-green-500";
  if (health >= 50) return "bg-amber-500";
  return "bg-red-500";
}

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
        "rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950",
        className,
      )}
    >
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
            size="sm"
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
            <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
              {/* Checkbox */}
              <th className="w-12 px-5 py-3">
                <Checkbox checked={isAllSelected} onChange={toggleSelectAll} />
              </th>
              <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3">
                Customer
              </th>
              <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3">
                Status
              </th>
              <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3">
                Plan
              </th>
              <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3">
                MRR
              </th>
              <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3">
                Health
              </th>
              <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3">
                Last Contact
              </th>
              <th className="text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 px-3 py-3">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr
                key={customer.id}
                className="border-b border-neutral-200 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                {/* Checkbox */}
                <td className="w-12 px-5 py-4">
                  <Checkbox
                    checked={selectedRows.includes(customer.id)}
                    onChange={() => toggleSelectRow(customer.id)}
                  />
                </td>

                {/* Customer */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Image
                      src={customer.avatar}
                      alt={customer.name}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full object-cover"
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
                <td className="px-5 py-4">
                  <Badge variant={statusConfig[customer.status].variant}>
                    {statusConfig[customer.status].label}
                  </Badge>
                </td>

                {/* Plan */}
                <td className="px-5 py-4">
                  <Badge variant={planConfig[customer.plan].variant}>
                    {planConfig[customer.plan].label}
                  </Badge>
                </td>

                {/* MRR */}
                <td className="px-5 py-4">
                  <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                    {formatMRR(customer.mrr)}
                  </span>
                </td>

                {/* Health */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-16 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          getHealthColor(customer.health),
                        )}
                        style={{ width: `${customer.health}%` }}
                      />
                    </div>
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">
                      {customer.health}
                    </span>
                  </div>
                </td>

                {/* Last Contact */}
                <td className="px-5 py-4">
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">
                    {customer.lastContact}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-3 py-4">
                  <div className="flex justify-center">
                    <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                      <DotsThreeVerticalIcon
                        size={20}
                        className="text-neutral-500"
                      />
                    </button>
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
    </div>
  );
}
