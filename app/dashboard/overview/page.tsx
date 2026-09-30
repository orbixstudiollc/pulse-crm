import {
  ActiveDeals,
  ActivityFeed,
  LatestLeads,
  Metric,
  MetricStrip,
  OverviewTabs,
  Page,
  PageHeaderActions,
  RevenueChart,
} from "@/components/dashboard";
import { OverviewHome } from "@/components/dashboard/OverviewHome";
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
    <Page>
      {/* Greeting, ask box and quick actions */}
      <OverviewHome firstName={firstName} actions={<PageHeaderActions />} />

      {/* Stats */}
      <MetricStrip className="mt-8 pb-0">
        <Metric
          label="Total Revenue"
          value={formatCurrency(stats?.totalRevenue ?? 0)}
          change={toChange(monthOverMonth(stats?.revenueThisMonth ?? 0, stats?.revenueLastMonth ?? 0))}
        />
        <Metric
          label="Active Deals"
          value={String(stats?.activeDeals ?? 0)}
          change={toChange(monthOverMonth(stats?.activeDealsThisMonth ?? 0, stats?.activeDealsLastMonth ?? 0))}
        />
        <Metric
          label="Total Leads"
          value={String(stats?.totalLeads ?? 0)}
          change={toChange(monthOverMonth(stats?.leadsThisMonth ?? 0, stats?.leadsLastMonth ?? 0))}
        />
      </MetricStrip>

      {/* Latest leads | Active deals | Activity | Revenue */}
      <OverviewTabs
        counts={{
          leads: stats?.totalLeads ?? 0,
          deals: stats?.activeDeals ?? 0,
          activity: (activityRes.data ?? []).length,
        }}
        leads={
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
          />
        }
        deals={
          <ActiveDeals
            total={pipelineValue}
            dealCount={stats?.activeDeals ?? 0}
            stages={stagesRes.data ?? []}
          />
        }
        activity={<ActivityFeed activities={activityRes.data ?? []} />}
        revenue={<RevenueChart data={revenueRes.data} />}
      />
    </Page>
  );
}
