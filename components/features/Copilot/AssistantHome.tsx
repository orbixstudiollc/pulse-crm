"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  CalendarBlankIcon,
  CaretRightIcon,
  CheckCircleIcon,
  ClockIcon,
  FireIcon,
  ShieldIcon,
  SparkleIcon,
  WarningIcon,
} from "@/components/ui";
import type { AssistantBrief } from "@/lib/actions/copilot-brief";
import { SUGGESTION_CHIP } from "./styles";

const MAX_TODAY_ITEMS = 4;
const APPROVALS_HREF = "/dashboard/copilot?view=approvals";
const PLAN_MY_DAY =
  "Plan my day: list what needs my attention today (follow-ups, hot leads, stuck deals and pending approvals) in priority order, with one next action for each.";

type TodayItem = {
  key: keyof AssistantBrief;
  icon: typeof FireIcon;
  tone: string;
  label(count: number): string;
} & ({ prompt: string } | { href: string });

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** In priority order; the first MAX_TODAY_ITEMS non-zero counts are shown. */
const TODAY_ITEMS: TodayItem[] = [
  {
    key: "overdueFollowups",
    icon: WarningIcon,
    tone: "text-warning",
    label: (n) => `overdue ${plural(n, "follow-up", "follow-ups")}`,
    prompt: "Show my overdue follow-ups, oldest first, and help me clear them one by one.",
  },
  {
    key: "followupsDueToday",
    icon: CalendarBlankIcon,
    tone: "text-accent-strong",
    label: (n) => `${plural(n, "follow-up", "follow-ups")} due today`,
    prompt: "Show the follow-ups due today and help me work through them one by one.",
  },
  {
    key: "pendingApprovals",
    icon: ShieldIcon,
    tone: "text-success",
    label: (n) => `${plural(n, "change", "changes")} waiting for your approval`,
    href: APPROVALS_HREF,
  },
  {
    key: "hotLeadsUntouched",
    icon: FireIcon,
    tone: "text-danger",
    label: (n) => `hot ${plural(n, "lead", "leads")} to follow up`,
    prompt: "Which hot leads haven't been contacted in the last 7 days? Rank them and help me reach out to each one.",
  },
  {
    key: "staleDeals",
    icon: ClockIcon,
    tone: "text-warning",
    label: (n) => `${plural(n, "deal", "deals")} with no update in 2 weeks`,
    prompt: "Show my open deals with no update in the last 14 days and suggest a next step for each.",
  },
];

const QUICK_ACTIONS: { group: string; actions: { label: string; prompt: string }[] }[] = [
  {
    group: "Leads",
    actions: [
      { label: "Who should I call today?", prompt: "Who should I call today? Rank my leads by urgency and tell me why for each." },
      { label: "Find ideal prospects", prompt: "Help me find ideal prospects that match my ICP. Analyze my current leads and suggest the best profiles to target." },
    ],
  },
  {
    group: "Deals",
    actions: [
      { label: "Summarize my pipeline", prompt: "Summarize my pipeline: value by stage, deals at risk and what changed this week." },
      { label: "Get advice", prompt: "I need advice on my sales strategy. Review my pipeline and suggest improvements." },
      { label: "Audit my workspace", prompt: "Audit my CRM workspace. Check for stale leads, stuck deals, missing follow-ups, and data quality issues." },
    ],
  },
  {
    group: "Outreach",
    actions: [
      { label: "Draft follow-ups for hot leads", prompt: "Draft follow-up emails for my hot leads, one per lead, personalized from their records." },
      { label: "Write a sequence", prompt: "Help me write an email sequence for lead outreach. I need a multi-step drip campaign." },
      { label: "Generate a full campaign", prompt: "Generate a full outreach campaign for my top leads. Include email sequences, follow-up timing, and personalization suggestions." },
    ],
  },
  {
    group: "Insights",
    actions: [
      { label: "Plan my day", prompt: PLAN_MY_DAY },
      { label: "Weekly analytics", prompt: "Give me a weekly analytics summary. Include pipeline changes, lead activity, deals won/lost, and key metrics." },
      { label: "Best performing campaigns", prompt: "Analyze my campaigns and tell me which ones are performing best. Include open rates, reply rates, and conversion metrics." },
    ],
  },
];

const ROW = "flex h-11 w-full items-center gap-3 border-b border-divider px-2 text-left text-[13px] text-fg transition-colors hover:bg-subtle";

function RowContent({ icon: Icon, tone, children }: { icon: typeof FireIcon; tone: string; children: ReactNode }) {
  return (
    <>
      <Icon size={16} aria-hidden="true" className={`shrink-0 ${tone}`} />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <CaretRightIcon size={12} aria-hidden="true" className="shrink-0 text-fg-muted" />
    </>
  );
}

function TodaySection({ brief, onPick }: { brief: AssistantBrief | null; onPick(prompt: string): void }) {
  const items = TODAY_ITEMS.flatMap((item) => {
    const count = brief?.[item.key];
    return typeof count === "number" && count > 0 ? [{ item, count }] : [];
  }).slice(0, MAX_TODAY_ITEMS);
  const allClear = brief !== null && Object.values(brief).every((value) => value === 0);

  return (
    <section className="py-6">
      <h3 className="mb-1 text-[16px] leading-6 font-semibold text-fg">Today</h3>
      {items.length === 0 ? (
        <>
          {allClear && (
            <p className="mb-3 flex items-center gap-1.5 text-[13px] text-fg-muted">
              <CheckCircleIcon size={14} aria-hidden="true" className="text-success" />
              You&apos;re all caught up
            </p>
          )}
          <ul className="mt-3 border-t border-divider">
            <li>
              <button type="button" onClick={() => onPick(PLAN_MY_DAY)} className={ROW}>
                <RowContent icon={SparkleIcon} tone="text-accent-strong">
                  Plan my day
                </RowContent>
              </button>
            </li>
          </ul>
        </>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-x-6 border-t border-divider sm:grid-cols-2">
          {items.map(({ item, count }) => {
            const content = (
              <RowContent icon={item.icon} tone={item.tone}>
                <span className="font-semibold tabular-nums">{count}</span> {item.label(count)}
              </RowContent>
            );
            return (
              <li key={item.key}>
                {"href" in item ? (
                  <Link href={item.href} className={ROW}>
                    {content}
                  </Link>
                ) : (
                  <button type="button" onClick={() => onPick(item.prompt)} className={ROW}>
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** The new-chat start screen: what needs attention today, then quick actions by area. */
export function AssistantHome({ brief, onPick }: { brief: AssistantBrief | null; onPick(prompt: string): void }) {
  return (
    <div>
      <TodaySection brief={brief} onPick={onPick} />
      <section className="border-t border-divider py-6">
        <h3 className="mb-4 text-[16px] leading-6 font-semibold text-fg">Quick actions</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {QUICK_ACTIONS.map(({ group, actions }) => (
            <div key={group}>
              <p className="mb-2 text-[13px] text-fg-muted">{group}</p>
              <div className="flex flex-wrap gap-2">
                {actions.map((action) => (
                  <button key={action.label} type="button" onClick={() => onPick(action.prompt)} className={SUGGESTION_CHIP}>
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
