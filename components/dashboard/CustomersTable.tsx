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
  { label: string; variant: "success" | "warning" | "neutral" }
> = {
  active: { label: "Active", variant: "success" },
  pending: { label: "Pending", variant: "warning" },
  inactive: { label: "Inactive", variant: "neutral" },
};

const planConfig = {
  enterprise: { label: "Enterprise", variant: "primary" as const },
  pro: { label: "Pro", variant: "info" as const },
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
        "rounded-lg border border-line bg-surface overflow-hidden",
        className,
      )}
    >
      {/* Bulk Actions Bar */}
      {selectedRows.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-divider bg-subtle">
          <span className="text-[13px] font-medium text-fg">
            {selectedRows.length} item{selectedRows.length > 1 ? "s" : ""}{" "}
            selected
          </span>
          <div className="flex items-center gap-3">
            <button className="text-[13px] text-fg-secondary hover:text-fg transition-colors">
              Email
            </button>
            <button className="text-[13px] text-fg-secondary hover:text-fg transition-colors">
              Edit
            </button>
            <button className="text-[13px] text-fg-secondary hover:text-fg transition-colors">
              Export
            </button>
            <button className="text-[13px] text-danger hover:opacity-80 transition-colors">
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
            <tr className="bg-muted">
              {/* Checkbox */}
              <th className="w-10 px-3 py-2">
                <Checkbox checked={isAllSelected} onChange={toggleSelectAll} />
              </th>
              <th className="px-3 py-2 text-left text-[13px] font-medium text-fg-secondary">
                Customer
              </th>
              <th className="px-3 py-2 text-left text-[13px] font-medium text-fg-secondary">
                Status
              </th>
              <th className="px-3 py-2 text-left text-[13px] font-medium text-fg-secondary">
                Plan
              </th>
              <th className="px-3 py-2 text-left text-[13px] font-medium text-fg-secondary">
                MRR
              </th>
              <th className="px-3 py-2 text-left text-[13px] font-medium text-fg-secondary">
                Health
              </th>
              <th className="px-3 py-2 text-left text-[13px] font-medium text-fg-secondary">
                Last Contact
              </th>
              <th className="px-3 py-2 text-center text-[13px] font-medium text-fg-secondary">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr
                key={customer.id}
                onClick={() => handleViewDetails(customer)}
                className="hover:bg-subtle transition-colors cursor-pointer"
              >
                {/* Checkbox */}
                <td
                  className="w-10 px-3 py-2 text-[13px] text-fg border-t border-row"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={selectedRows.includes(customer.id)}
                    onChange={() => toggleSelectRow(customer.id)}
                  />
                </td>
                {/* Customer */}
                <td className="px-3 py-2 text-[13px] text-fg border-t border-row">
                  <div className="flex items-center gap-3 [&>div:first-child>div]:size-8 [&>div:first-child>div]:text-xs">
                    <Avatar
                      src={customer.avatar}
                      name={customer.name}
                      size="lg"
                    />
                    <div>
                      <p className="text-[13px] font-medium text-fg">
                        {customer.name}
                      </p>
                      <p className="text-xs text-fg-secondary">
                        {customer.email}
                      </p>
                    </div>
                  </div>
                </td>
                {/* Status */}
                <td className="px-3 py-2 text-[13px] text-fg border-t border-row">
                  <Badge variant={statusConfig[customer.status].variant}>
                    {statusConfig[customer.status].label}
                  </Badge>
                </td>
                {/* Plan */}
                <td className="px-3 py-2 text-[13px] text-fg border-t border-row">
                  <Badge variant={planConfig[customer.plan].variant}>
                    {planConfig[customer.plan].label}
                  </Badge>
                </td>
                {/* MRR */}
                <td className="px-3 py-2 text-[13px] text-fg border-t border-row">
                  <span className="text-[13px] font-medium text-fg">
                    {formatMRR(customer.mrr)}
                  </span>
                </td>
                {/* Health */}
                <td className="px-3 py-2 text-[13px] text-fg border-t border-row">
                  <div className="flex items-center gap-2">
                    <Progress
                      value={customer.healthScore}
                      color="auto"
                      className="w-16"
                    />
                    <span className="text-[13px] text-fg-secondary">
                      {customer.healthScore}
                    </span>
                  </div>
                </td>
                {/* Last Contact */}
                <td className="px-3 py-2 text-[13px] text-fg border-t border-row">
                  <span className="text-[13px] text-fg-secondary">
                    {customer.lastContact}
                  </span>
                </td>
                {/* Actions */}
                <td
                  className="px-3 py-2 text-[13px] text-fg border-t border-row"
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
