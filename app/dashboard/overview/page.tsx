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
import { getDashboardStats, getRevenueChartData, getLatestLeads, getActivityFeed, getActiveDealsByStage } from "@/lib/actions/dashboard";
import { getActiveDeals } from "@/lib/actions/dashboard";
import { createClient } from "@/lib/supabase/server";
import type { LeadSource } from "@/lib/data/leads";

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toLocaleString()}`;
}

export default async function OverviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name")
    .eq("id", user!.id)
    .single();

  const firstName = profile?.first_name || "there";

  const [statsRes, revenueRes, dealsRes, leadsRes, activityRes, stagesRes] = await Promise.all([
    getDashboardStats(),
    getRevenueChartData(12),
    getActiveDeals(5),
    getLatestLeads(6),
    getActivityFeed(10),
    getActiveDealsByStage(),
  ]);

  const stats = statsRes.data;

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 space-y-4">
      {/* Page Header */}
      <PageHeader title={`Welcome back, ${firstName}`}>
        <PageHeaderActions />
      </PageHeader>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(stats?.totalRevenue ?? 0)}
          change={{ value: "+12.5%", trend: "up" }}
          icon={
            <CurrencyDollarIcon
              size={20}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
        <StatCard
          label="Active Deals"
          value={String(stats?.activeDeals ?? 0)}
          change={{ value: "+8", trend: "up" }}
          icon={
            <TrophyIcon
              size={20}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
        <StatCard
          label="Total Leads"
          value={String(stats?.totalLeads ?? 0)}
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
        <RevenueChart data={revenueRes.data} className="lg:col-span-2" />
        <ActiveDeals
          total={stats?.totalRevenue ?? 0}
          dealCount={stats?.activeDeals ?? 0}
          stages={stagesRes.data ?? []}
        />
      </div>

      {/* Leads & Activity Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <LatestLeads
          leads={leadsRes.data?.map((l: Record<string, unknown>) => ({
            id: l.id as string,
            name: l.name as string,
            email: (l.email as string) || "",
            company: (l.company as string) || "",
            phone: (l.phone as string) || "",
            linkedin: "",
            location: "",
            employees: "",
            website: (l.website as string) || "",
            industry: (l.industry as string) || "",
            status: ((l.status as string) || "cold") as "hot" | "warm" | "cold",
            source: ((l.source as string) || "Website") as LeadSource,
            estimatedValue: (l.estimated_value as number) || 0,
            score: (l.score as number) || 0,
            winProbability: (l.win_probability as number) || 0,
            daysInPipeline: (l.days_in_pipeline as number) || 0,
            createdDate: l.created_at ? new Date(l.created_at as string).toLocaleDateString() : "",
          }))}
          totalLeads={stats?.totalLeads ?? 0}
          className="lg:col-span-2"
        />
        <ActivityFeed activities={activityRes.data ?? []} />
      </div>
    </div>
  );
}
