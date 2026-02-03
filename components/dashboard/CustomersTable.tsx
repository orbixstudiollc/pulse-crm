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
  // Extended fields for drawer
  company?: string;
  industry?: string;
  phone?: string;
  location?: string;
  lifetimeValue?: number;
  tenure?: number;
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
    company: "NextGen Solutions",
    industry: "Technology",
    phone: "+1 (555) 123-4567",
    location: "San Francisco, CA",
    lifetimeValue: 58800,
    tenure: 24,
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
    company: "Acme Corp",
    industry: "Manufacturing",
    phone: "+1 (555) 234-5678",
    location: "New York, NY",
    lifetimeValue: 3576,
    tenure: 18,
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
    company: "GlobalTech Inc",
    industry: "Finance",
    phone: "+1 (555) 345-6789",
    location: "Chicago, IL",
    lifetimeValue: 75600,
    tenure: 12,
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
    company: "Innovate Co",
    industry: "Healthcare",
    phone: "+1 (555) 456-7890",
    location: "Seattle, WA",
    lifetimeValue: 7176,
    tenure: 24,
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
    company: "Design Studio",
    industry: "Creative",
    phone: "+1 (555) 567-8901",
    location: "Austin, TX",
    lifetimeValue: 588,
    tenure: 6,
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
    company: "Finance Plus",
    industry: "Finance",
    phone: "+1 (555) 678-9012",
    location: "Boston, MA",
    lifetimeValue: 204000,
    tenure: 36,
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
    setSelectedCustomer(customer);
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
                className="border-b-[0.5px] border-neutral-200 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                {/* Checkbox */}
                <td className="w-12 px-5 py-4">
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
                      value={customer.health}
                      color="auto"
                      className="w-16"
                    />
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">
                      {customer.health}
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
                <td className="px-3 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
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
                          onClick: () => console.log("Edit", customer.id),
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
                name: selectedCustomer.name,
                email: selectedCustomer.email,
                avatar: selectedCustomer.avatar,
                monthlyRevenue: selectedCustomer.mrr,
                healthScore: selectedCustomer.health,
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
