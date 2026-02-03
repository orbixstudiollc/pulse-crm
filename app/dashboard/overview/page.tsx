import {
  ActiveDeals,
  ActivityFeed,
  LatestLeads,
  PageHeader,
  PageHeaderActions,
  RevenueChart,
  StatCard,
} from "@/components/dashboard";
import {
  CurrencyDollarIcon,
  TrophyIcon,
  UsersThreeIcon,
} from "@/components/ui";

export default function OverviewPage() {
  return (
    <div className="py-6 px-8 space-y-4">
      {/* Page Header */}
      <PageHeader title="Welcome back, Angel">
        <PageHeaderActions />
      </PageHeader>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total Revenue"
          value="$124,500"
          change={{ value: "+12.5%", trend: "up" }}
          icon={
            <CurrencyDollarIcon
              size={20}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
        <StatCard
          label="Deals Won"
          value="24"
          change={{ value: "+8", trend: "up" }}
          icon={
            <TrophyIcon
              size={20}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
        <StatCard
          label="New Leads"
          value="156"
          change={{ value: "+23%", trend: "up" }}
          icon={
            <UsersThreeIcon
              size={20}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RevenueChart className="lg:col-span-2" />
        <ActiveDeals />
      </div>

      {/* Leads & Activity Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <LatestLeads className="lg:col-span-2" />
        <ActivityFeed />
      </div>
    </div>
  );
}
