import {
  ActiveDeals,
  ActivityFeed,
  LatestLeads,
  PageHeaderActions,
  RevenueChart,
  StatCard,
} from "@/components/dashboard";
import { OverviewHome } from "@/components/dashboard/OverviewHome";
import {
  CurrencyDollarIcon,
  TrophyIcon,
  UsersThreeIcon,
} from "@/components/ui";
import { getDashboardStats, getRevenueChartData, getLatestLeads, getActivityFeed, getActiveDealsByStage } from "@/lib/actions/dashboard";
import { getActiveDeals } from "@/lib/actions/dashboard";
import { createClient } from "@/lib/supabase/server";
import type { LeadSource } from "@/lib/data/leads";
import { monthOverMonth, type PeriodDelta } from "@/lib/stats/period-delta";

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toLocaleString()}`;
}

function toChange(delta: PeriodDelta | null) {
  return delta ? { value: delta.text, trend: delta.trend } : undefined;
}

export default async function OverviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name")
    .eq("id", user!.id)
    .single();

  const firstName = profile?.first_name ?? null;

  const [statsRes, revenueRes, dealsRes, leadsRes, activityRes, stagesRes] = await Promise.all([
    getDashboardStats(),
    getRevenueChartData(12),
    getActiveDeals(5),
    getLatestLeads(6),
    getActivityFeed(10),
    getActiveDealsByStage(),
  ]);

  const stats = statsRes.data;
  const pipelineValue = (stagesRes.data ?? []).reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Greeting, ask box and quick actions */}
      <OverviewHome firstName={firstName} actions={<PageHeaderActions />} />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(stats?.totalRevenue ?? 0)}
          change={toChange(monthOverMonth(stats?.revenueThisMonth ?? 0, stats?.revenueLastMonth ?? 0))}
          icon={
            <CurrencyDollarIcon
              size={20}
              className="text-fg"
            />
          }
        />
        <StatCard
          label="Active Deals"
          value={String(stats?.activeDeals ?? 0)}
          change={toChange(monthOverMonth(stats?.activeDealsThisMonth ?? 0, stats?.activeDealsLastMonth ?? 0))}
          icon={
            <TrophyIcon
              size={20}
              className="text-fg"
            />
          }
        />
        <StatCard
          label="Total Leads"
          value={String(stats?.totalLeads ?? 0)}
          change={toChange(monthOverMonth(stats?.leadsThisMonth ?? 0, stats?.leadsLastMonth ?? 0))}
          icon={
            <UsersThreeIcon
              size={20}
              className="text-fg"
            />
          }
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RevenueChart data={revenueRes.data} className="lg:col-span-2" />
        <ActiveDeals
          total={pipelineValue}
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
            title: (l.title as string) || "",
            linkedin: (l.linkedin as string) || "",
            twitter: (l.twitter as string) || "",
            facebook: (l.facebook as string) || "",
            instagram: (l.instagram as string) || "",
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
            painPoints: (l.pain_points as string) || "",
            triggerEvent: (l.trigger_event as string) || "",
            timezone: (l.timezone as string) || "",
            preferredLanguage: (l.preferred_language as string) || "",
            lastContactedAt: (l.last_contacted_at as string) || "",
            tags: Array.isArray(l.tags) ? l.tags as string[] : [],
            revenueRange: (l.revenue_range as string) || "",
            techStack: (l.tech_stack as string) || "",
            fundingStage: (l.funding_stage as string) || "",
            decisionRole: (l.decision_role as string) || "",
            currentSolution: (l.current_solution as string) || "",
            referredBy: (l.referred_by as string) || "",
            personalNote: (l.personal_note as string) || "",
            birthday: (l.birthday as string) || "",
            contentInterests: Array.isArray(l.content_interests) ? l.content_interests as string[] : [],
            meetingPreference: (l.meeting_preference as string) || "",
            assistantName: (l.assistant_name as string) || "",
            assistantEmail: (l.assistant_email as string) || "",
          }))}
          totalLeads={stats?.totalLeads ?? 0}
          className="lg:col-span-2"
        />
        <ActivityFeed activities={activityRes.data ?? []} />
      </div>
    </div>
  );
}
