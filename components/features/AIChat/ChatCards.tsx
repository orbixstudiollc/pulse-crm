"use client";

import {
  CurrencyDollarIcon,
  UserIcon,
  FunnelIcon,
  ChartBarIcon,
  EnvelopeIcon,
  PhoneIcon,
  CrosshairIcon,
} from "@/components/ui/Icons";

interface ChatDealCardProps {
  name: string;
  value?: number;
  stage?: string;
  probability?: number;
  contactName?: string;
  closeDate?: string;
}

export function ChatDealCard({ name, value, stage, probability, contactName, closeDate }: ChatDealCardProps) {
  return (
    <div className="my-1 rounded-md border border-line bg-surface p-3 text-xs">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center">
          <CurrencyDollarIcon size={14} className="text-fg-secondary" />
        </div>
        <span className="font-semibold text-fg truncate">{name}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-fg-secondary">
        {value !== undefined && (
          <div>Value: <span className="font-medium text-fg">${value.toLocaleString()}</span></div>
        )}
        {stage && (
          <div>Stage: <span className="font-medium text-fg capitalize">{stage.replace(/_/g, " ")}</span></div>
        )}
        {probability !== undefined && (
          <div>Prob: <span className="font-medium text-fg">{probability}%</span></div>
        )}
        {closeDate && (
          <div>Close: <span className="font-medium text-fg">{closeDate}</span></div>
        )}
      </div>
      {contactName && (
        <div className="mt-1.5 text-fg-secondary flex items-center gap-1">
          <UserIcon size={12} /> {contactName}
        </div>
      )}
    </div>
  );
}

interface ChatLeadCardProps {
  name: string;
  company?: string;
  score?: number | null;
  status?: string;
  email?: string;
}

export function ChatLeadCard({ name, company, score, status, email }: ChatLeadCardProps) {
  const scoreColor = score !== null && score !== undefined
    ? score >= 70 ? "text-success"
      : score >= 40 ? "text-warning"
      : "text-danger"
    : "text-fg-muted";

  return (
    <div className="my-1 rounded-md border border-line bg-surface p-3 text-xs">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center">
          <CrosshairIcon size={14} className="text-fg-secondary" />
        </div>
        <span className="font-semibold text-fg truncate">{name}</span>
        {score !== null && score !== undefined && (
          <span className={`ml-auto font-semibold ${scoreColor}`}>{score}/100</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-fg-secondary">
        {company && <div>Company: <span className="font-medium text-fg">{company}</span></div>}
        {status && <div>Status: <span className="font-medium text-fg capitalize">{status.replace(/_/g, " ")}</span></div>}
        {email && <div className="col-span-2 flex items-center gap-1"><EnvelopeIcon size={12} /> {email}</div>}
      </div>
    </div>
  );
}

interface ChatContactCardProps {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
}

export function ChatContactCard({ firstName, lastName, email, phone, company, jobTitle }: ChatContactCardProps) {
  return (
    <div className="my-1 rounded-md border border-line bg-surface p-3 text-xs">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center">
          <UserIcon size={14} className="text-fg-secondary" />
        </div>
        <div className="min-w-0">
          <span className="font-semibold text-fg">{firstName} {lastName}</span>
          {jobTitle && <span className="text-fg-secondary"> · {jobTitle}</span>}
        </div>
      </div>
      <div className="space-y-1 text-fg-secondary">
        {company && <div>Company: <span className="font-medium text-fg">{company}</span></div>}
        {email && <div className="flex items-center gap-1"><EnvelopeIcon size={12} /> {email}</div>}
        {phone && <div className="flex items-center gap-1"><PhoneIcon size={12} /> {phone}</div>}
      </div>
    </div>
  );
}

interface ChatPipelineCardProps {
  totalDeals: number;
  totalValue: number;
  weightedValue: number;
  stages: { stage: string; count: number; value: number }[];
}

export function ChatPipelineCard({ totalDeals, totalValue, weightedValue, stages }: ChatPipelineCardProps) {
  return (
    <div className="my-1 rounded-md border border-line bg-surface p-3 text-xs">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center">
          <FunnelIcon size={14} className="text-fg-secondary" />
        </div>
        <span className="font-semibold text-fg">Pipeline Summary</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="text-center p-1.5 rounded-md bg-subtle">
          <div className="font-semibold text-fg">{totalDeals}</div>
          <div className="text-fg-secondary">Deals</div>
        </div>
        <div className="text-center p-1.5 rounded-md bg-subtle">
          <div className="font-semibold text-fg">${(totalValue / 1000).toFixed(0)}k</div>
          <div className="text-fg-secondary">Pipeline</div>
        </div>
        <div className="text-center p-1.5 rounded-md bg-subtle">
          <div className="font-semibold text-fg">${(weightedValue / 1000).toFixed(0)}k</div>
          <div className="text-fg-secondary">Weighted</div>
        </div>
      </div>
      {stages.length > 0 && (
        <div className="space-y-1">
          {stages.map((s) => (
            <div key={s.stage} className="flex items-center justify-between">
              <span className="capitalize text-fg-secondary">{s.stage.replace(/_/g, " ")}</span>
              <span className="text-fg font-medium">{s.count} · ${s.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ChatAnalyticsCardProps {
  period: string;
  newLeads: number;
  dealsWon: number;
  wonValue: number;
  pipelineValue: number;
  activities: number;
}

export function ChatAnalyticsCard({ period, newLeads, dealsWon, wonValue, pipelineValue, activities }: ChatAnalyticsCardProps) {
  return (
    <div className="my-1 rounded-md border border-line bg-surface p-3 text-xs">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center">
          <ChartBarIcon size={14} className="text-fg-secondary" />
        </div>
        <span className="font-semibold text-fg">Analytics · {period}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="p-1.5 rounded-md bg-subtle text-center">
          <div className="font-semibold text-fg">{newLeads}</div>
          <div className="text-fg-secondary">New Leads</div>
        </div>
        <div className="p-1.5 rounded-md bg-subtle text-center">
          <div className="font-semibold text-fg">{dealsWon}</div>
          <div className="text-fg-secondary">Won</div>
        </div>
        <div className="p-1.5 rounded-md bg-subtle text-center">
          <div className="font-semibold text-fg">${(wonValue / 1000).toFixed(0)}k</div>
          <div className="text-fg-secondary">Revenue</div>
        </div>
        <div className="p-1.5 rounded-md bg-subtle text-center">
          <div className="font-semibold text-fg">{activities}</div>
          <div className="text-fg-secondary">Activities</div>
        </div>
      </div>
    </div>
  );
}
