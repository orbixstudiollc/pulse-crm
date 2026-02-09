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
import { customers as allCustomers } from "@/lib/data/customers";

export default function CustomersPage() {
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");

  // Filter customers
  const filteredCustomers = allCustomers.filter((customer) => {
    // Search filter
    const matchesSearch =
      searchValue === "" ||
      customer.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchValue.toLowerCase()) ||
      customer.company.toLowerCase().includes(searchValue.toLowerCase());

    // Status filter
    const matchesStatus =
      statusFilter === "all" || customer.status === statusFilter;

    // Plan filter
    const matchesPlan = planFilter === "all" || customer.plan === planFilter;

    // Health score filter
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

  // Calculate overall stats (not affected by filters)
  const totalCustomers = allCustomers.length;
  const activeCount = allCustomers.filter((c) => c.status === "active").length;
  const atRiskCount = allCustomers.filter((c) => c.healthScore < 50).length;

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 space-y-4">
      <PageHeader title="Customers">
        <Button variant="outline" leftIcon={<ExportIcon size={20} />}>
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
