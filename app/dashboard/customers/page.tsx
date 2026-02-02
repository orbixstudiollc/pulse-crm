import {
  customerPlanOptions,
  customerScoreOptions,
  CustomersTable,
  customerStatusOptions,
  FilterBar,
  PageHeader,
  StatCard,
  timeRangeOptions,
} from "@/components/dashboard";
import {
  Button,
  CheckCircleIcon,
  ExportIcon,
  PlusIcon,
  UsersThreeIcon,
  WarningIcon,
} from "@/components/ui";

export default function CustomersPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Customers">
        <Button variant="outline" leftIcon={<ExportIcon size={20} />}>
          Export
        </Button>
        <Button leftIcon={<PlusIcon size={20} weight="bold" />}>
          Add Customer
        </Button>
      </PageHeader>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Total Customers"
          value="45,401"
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
          value="40,034"
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
          value="5,320"
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
        filters={[
          {
            key: "status",
            options: customerStatusOptions,
            defaultValue: "all",
          },
          { key: "plan", options: customerPlanOptions, defaultValue: "all" },
          { key: "score", options: customerScoreOptions, defaultValue: "all" },
          { key: "time", options: timeRangeOptions, defaultValue: "all" },
        ]}
      />

      {/* Customers Table */}
      <CustomersTable />
    </div>
  );
}
