import { ActiveDeals, RevenueChart, StatCard } from "@/components/dashboard";
import {
  Button,
  CalendarBlankIcon,
  CaretDownIcon,
  CurrencyDollarIcon,
  PlusIcon,
  TrophyIcon,
  UsersThreeIcon,
} from "@/components/ui";

export default function OverviewPage() {
  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-2">
          Welcome back, Angel
        </h1>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            leftIcon={<CalendarBlankIcon size={20} />}
            rightIcon={<CaretDownIcon size={20} />}
          >
            This Month
          </Button>
          <Button leftIcon={<PlusIcon size={20} weight="bold" />}>
            Add Lead
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total Revenue"
          value="$124,500"
          change={{ value: "+12.5%", trend: "up" }}
          icon={
            <CurrencyDollarIcon
              size={20}
              className="text-neutral-600 dark:text-neutral-400"
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
              className="text-neutral-600 dark:text-neutral-400"
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
              className="text-neutral-600 dark:text-neutral-400"
            />
          }
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RevenueChart className="lg:col-span-2" />
        <ActiveDeals />
      </div>
    </div>
  );
}
