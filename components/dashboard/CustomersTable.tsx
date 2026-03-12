"use client";

import { useState } from "react";
import {
  Avatar,
  Badge,
  Checkbox,
  Progress,
  ActionMenu,
  EyeIcon,
  PencilSimpleIcon,
  TrashIcon,
} from "@/components/ui";
import { CustomerDrawer } from "./CustomerDrawer";
import { TableHeader } from "./TableHeader";
import { TableFooter } from "./TableFooter";
import { cn } from "@/lib/utils";
import { Customer } from "@/lib/data/customers";

type CustomerStatus = "active" | "pending" | "inactive";

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

const planConfig = {
  enterprise: { label: "Enterprise", variant: "violet" as const },
  pro: { label: "Pro", variant: "blue" as const },
  starter: { label: "Starter", variant: "neutral" as const },
  free: { label: "Free", variant: "neutral" as const },
};

function formatMRR(value: number) {
  return `$${value.toLocaleString()}`;
}

export function CustomersTable({
  customers = [],
  totalCustomers = 0,
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
    setSelectedCustomer(customer);
    setDrawerOpen(true);
  };

  const isAllSelected = selectedRows.length === customers.length;

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

      {/* Table Header */}
      <TableHeader
        title="All Customers"
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(value) => {
          setRowsPerPage(value);
          setCurrentPage(1);
        }}
      />

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

      {/* Table Footer with Pagination */}
      <TableFooter
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalCustomers}
        startIndex={startIndex}
        endIndex={endIndex}
        onPageChange={setCurrentPage}
        itemLabel="customers"
      />

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
