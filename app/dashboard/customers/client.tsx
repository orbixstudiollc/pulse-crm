"use client";

import { useState } from "react";
import Link from "next/link";
import {
  customerPlanOptions,
  customerScoreOptions,
  CustomersTable,
  customerStatusOptions,
  FilterBar,
  PageHeader,
  StatCard,
  timeRangeOptions,
  EmptyState,
  TableHeader,
} from "@/components/dashboard";
import {
  Button,
  CheckCircleIcon,
  ExportIcon,
  PlusIcon,
  UsersThreeIcon,
  WarningIcon,
  UploadIcon,
} from "@/components/ui";
import type { Customer } from "@/lib/data/customers";
import { exportCustomersToCSV } from "@/lib/actions/export";
import { toast } from "sonner";

interface CustomerRecord {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
  status: string;
  plan: string;
  health_score: number;
  mrr?: number;
  last_contact?: string | null;
  [key: string]: unknown;
}

// Map DB record to the shape CustomersTable expects
function mapCustomer(c: CustomerRecord): Customer {
  return {
    id: c.id,
    name: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
    email: c.email || "",
    company: c.company || "",
    status: (c.status || "active") as Customer["status"],
    plan: (c.plan || "free") as Customer["plan"],
    healthScore: c.health_score ?? 80,
    mrr: (c.mrr as number) ?? 0,
    lastContact: (c.last_contact as string) ?? "",
  };
}

export function CustomersPageClient({
  initialCustomers,
  initialCount,
}: {
  initialCustomers: CustomerRecord[];
  initialCount: number;
}) {
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");

  const allCustomers = initialCustomers.map(mapCustomer);

  // Filter customers client-side
  const filteredCustomers = allCustomers.filter((customer) => {
    const matchesSearch =
      searchValue === "" ||
      customer.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchValue.toLowerCase()) ||
      (customer.company ?? "").toLowerCase().includes(searchValue.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || customer.status === statusFilter;

    const matchesPlan = planFilter === "all" || customer.plan === planFilter;

    let matchesHealth = true;
    if (healthFilter !== "all") {
      const threshold = parseInt(healthFilter);
      if (threshold === 90) {
        matchesHealth = customer.healthScore >= 80;
      } else if (threshold === 70) {
        matchesHealth = customer.healthScore >= 50 && customer.healthScore < 80;
      } else if (threshold === 50) {
        matchesHealth = customer.healthScore < 50;
      }
    }

    return matchesSearch && matchesStatus && matchesPlan && matchesHealth;
  });

  const handleFilterChange = (key: string, value: string) => {
    switch (key) {
      case "status":
        setStatusFilter(value);
        break;
      case "plan":
        setPlanFilter(value);
        break;
      case "health":
        setHealthFilter(value);
        break;
    }
  };

  const totalCustomers = allCustomers.length;
  const activeCount = allCustomers.filter((c) => c.status === "active").length;
  const atRiskCount = allCustomers.filter((c) => c.healthScore < 50).length;

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 space-y-4">
      <PageHeader title="Customers">
        <Button
          variant="outline"
          leftIcon={<ExportIcon size={20} />}
          onClick={async () => {
            const result = await exportCustomersToCSV();
            if (result.error) { toast.error(result.error); return; }
            const blob = new Blob([result.csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `customers-export-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click(); URL.revokeObjectURL(url);
            toast.success("Customers exported successfully");
          }}
        >
          Export
        </Button>
        <Link href="/dashboard/customers/add">
          <Button leftIcon={<PlusIcon size={20} weight="bold" />}>
            Add Customer
          </Button>
        </Link>
      </PageHeader>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Total Customers"
          value={totalCustomers.toLocaleString()}
          change={{ value: "+12.5%", trend: "up" }}
          icon={
            <UsersThreeIcon
              size={20}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
        <StatCard
          label="Active"
          value={activeCount.toLocaleString()}
          change={{ value: "+24.5%", trend: "up" }}
          icon={
            <CheckCircleIcon
              size={20}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
        <StatCard
          label="At Risk"
          value={atRiskCount.toLocaleString()}
          change={{ value: "+15.2%", trend: "up" }}
          icon={
            <WarningIcon
              size={20}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
      </div>

      {/* Filters */}
      <FilterBar
        searchPlaceholder="Search customers..."
        onSearchChange={setSearchValue}
        filters={[
          {
            key: "status",
            label: "Status",
            options: customerStatusOptions,
            defaultValue: "all",
          },
          {
            key: "plan",
            label: "Plan",
            options: customerPlanOptions,
            defaultValue: "all",
          },
          {
            key: "health",
            label: "Health",
            options: customerScoreOptions,
            defaultValue: "all",
          },
          {
            key: "time",
            label: "Time",
            options: timeRangeOptions,
            defaultValue: "all",
          },
        ]}
        onFilterChange={handleFilterChange}
      />

      {/* Customers Table or Empty State */}
      {filteredCustomers.length > 0 ? (
        <CustomersTable
          customers={filteredCustomers}
          totalCustomers={filteredCustomers.length}
        />
      ) : (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
          <TableHeader
            title="All Customers"
            rowsPerPage="5"
            onRowsPerPageChange={() => {}}
          />
          <EmptyState
            icon={<UsersThreeIcon size={24} />}
            title={
              searchValue ||
              statusFilter !== "all" ||
              planFilter !== "all" ||
              healthFilter !== "all"
                ? "No customers found"
                : "No customers yet"
            }
            description={
              searchValue ||
              statusFilter !== "all" ||
              planFilter !== "all" ||
              healthFilter !== "all"
                ? "Try adjusting your search or filters to find what you're looking for."
                : "Get started by adding your first customer. Import from a CSV or add them manually."
            }
            actions={
              searchValue ||
              statusFilter !== "all" ||
              planFilter !== "all" ||
              healthFilter !== "all"
                ? [
                    {
                      label: "Clear Filters",
                      variant: "outline",
                      onClick: () => {
                        setSearchValue("");
                        setStatusFilter("all");
                        setPlanFilter("all");
                        setHealthFilter("all");
                      },
                    },
                  ]
                : [
                    {
                      label: "Import CSV",
                      icon: <UploadIcon size={18} />,
                      variant: "outline",
                    },
                    {
                      label: "Add Customer",
                      icon: <PlusIcon size={18} weight="bold" />,
                      variant: "primary",
                      href: "/dashboard/customers/add",
                    },
                  ]
            }
          />
        </div>
      )}
    </div>
  );
}
