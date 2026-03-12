"use client";

import {
  CurrencyDollarIcon,
  UserIcon,
  FunnelIcon,
  ChartBarIcon,
  CheckCircleIcon,
  WarningIcon,
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
    <div className="my-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 p-3 text-xs">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center">
          <CurrencyDollarIcon size={14} className="text-neutral-600 dark:text-neutral-400" />
        </div>
        <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">{name}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-neutral-600 dark:text-neutral-400">
        {value !== undefined && (
          <div>Value: <span className="font-medium text-neutral-900 dark:text-neutral-100">${value.toLocaleString()}</span></div>
        )}
        {stage && (
          <div>Stage: <span className="font-medium text-neutral-900 dark:text-neutral-100 capitalize">{stage.replace(/_/g, " ")}</span></div>
        )}
        {probability !== undefined && (
          <div>Prob: <span className="font-medium text-neutral-900 dark:text-neutral-100">{probability}%</span></div>
        )}
        {closeDate && (
          <div>Close: <span className="font-medium text-neutral-900 dark:text-neutral-100">{closeDate}</span></div>
        )}
      </div>
      {contactName && (
        <div className="mt-1.5 text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
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
    ? score >= 70 ? "text-green-600 dark:text-green-400"
      : score >= 40 ? "text-yellow-600 dark:text-yellow-400"
      : "text-red-500 dark:text-red-400"
    : "text-neutral-400";

  return (
    <div className="my-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 p-3 text-xs">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center">
          <CrosshairIcon size={14} className="text-neutral-600 dark:text-neutral-400" />
        </div>
        <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">{name}</span>
        {score !== null && score !== undefined && (
          <span className={`ml-auto font-bold ${scoreColor}`}>{score}/100</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-neutral-600 dark:text-neutral-400">
        {company && <div>Company: <span className="font-medium text-neutral-900 dark:text-neutral-100">{company}</span></div>}
        {status && <div>Status: <span className="font-medium text-neutral-900 dark:text-neutral-100 capitalize">{status.replace(/_/g, " ")}</span></div>}
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
    <div className="my-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 p-3 text-xs">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center">
          <UserIcon size={14} className="text-neutral-600 dark:text-neutral-400" />
        </div>
        <div className="min-w-0">
          <span className="font-semibold text-neutral-900 dark:text-neutral-100">{firstName} {lastName}</span>
          {jobTitle && <span className="text-neutral-500 dark:text-neutral-400"> · {jobTitle}</span>}
        </div>
      </div>
      <div className="space-y-1 text-neutral-600 dark:text-neutral-400">
        {company && <div>Company: <span className="font-medium text-neutral-900 dark:text-neutral-100">{company}</span></div>}
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
    <div className="my-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 p-3 text-xs">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center">
          <FunnelIcon size={14} className="text-neutral-600 dark:text-neutral-400" />
        </div>
        <span className="font-semibold text-neutral-900 dark:text-neutral-100">Pipeline Summary</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="text-center p-1.5 rounded bg-neutral-50 dark:bg-neutral-800">
          <div className="font-bold text-neutral-900 dark:text-neutral-100">{totalDeals}</div>
          <div className="text-neutral-500">Deals</div>
        </div>
        <div className="text-center p-1.5 rounded bg-neutral-50 dark:bg-neutral-800">
          <div className="font-bold text-neutral-900 dark:text-neutral-100">${(totalValue / 1000).toFixed(0)}k</div>
          <div className="text-neutral-500">Pipeline</div>
        </div>
        <div className="text-center p-1.5 rounded bg-neutral-50 dark:bg-neutral-800">
          <div className="font-bold text-neutral-900 dark:text-neutral-100">${(weightedValue / 1000).toFixed(0)}k</div>
          <div className="text-neutral-500">Weighted</div>
        </div>
      </div>
      {stages.length > 0 && (
        <div className="space-y-1">
          {stages.map((s) => (
            <div key={s.stage} className="flex items-center justify-between">
              <span className="capitalize text-neutral-600 dark:text-neutral-400">{s.stage.replace(/_/g, " ")}</span>
              <span className="text-neutral-900 dark:text-neutral-100 font-medium">{s.count} · ${s.value.toLocaleString()}</span>
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
    <div className="my-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 p-3 text-xs">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center">
          <ChartBarIcon size={14} className="text-neutral-600 dark:text-neutral-400" />
        </div>
        <span className="font-semibold text-neutral-900 dark:text-neutral-100">Analytics · {period}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="p-1.5 rounded bg-neutral-50 dark:bg-neutral-800 text-center">
          <div className="font-bold text-neutral-900 dark:text-neutral-100">{newLeads}</div>
          <div className="text-neutral-500">New Leads</div>
        </div>
        <div className="p-1.5 rounded bg-neutral-50 dark:bg-neutral-800 text-center">
          <div className="font-bold text-neutral-900 dark:text-neutral-100">{dealsWon}</div>
          <div className="text-neutral-500">Won</div>
        </div>
        <div className="p-1.5 rounded bg-neutral-50 dark:bg-neutral-800 text-center">
          <div className="font-bold text-neutral-900 dark:text-neutral-100">${(wonValue / 1000).toFixed(0)}k</div>
          <div className="text-neutral-500">Revenue</div>
        </div>
        <div className="p-1.5 rounded bg-neutral-50 dark:bg-neutral-800 text-center">
          <div className="font-bold text-neutral-900 dark:text-neutral-100">{activities}</div>
          <div className="text-neutral-500">Activities</div>
        </div>
      </div>
    </div>
  );
}

interface ChatActionPreviewProps {
  action: string;
  description: string;
  details: Record<string, string>;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
  isCompleted?: boolean;
  error?: string;
}

export function ChatActionPreview({
  action,
  description,
  details,
  onConfirm,
  onCancel,
  isPending,
  isCompleted,
  error,
}: ChatActionPreviewProps) {
  return (
    <div className="my-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 p-3 text-xs">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-6 h-6 rounded flex items-center justify-center ${isCompleted ? "bg-green-100 dark:bg-green-900/30" : error ? "bg-red-100 dark:bg-red-900/30" : "bg-neutral-100 dark:bg-neutral-700"}`}>
          {isCompleted ? (
            <CheckCircleIcon size={14} className="text-green-600 dark:text-green-400" />
          ) : error ? (
            <WarningIcon size={14} className="text-red-500 dark:text-red-400" />
          ) : (
            <FunnelIcon size={14} className="text-neutral-600 dark:text-neutral-400" />
          )}
        </div>
        <span className="font-semibold text-neutral-900 dark:text-neutral-100">{action}</span>
      </div>
      <p className="text-neutral-600 dark:text-neutral-400 mb-2">{description}</p>
      <div className="space-y-1 mb-3">
        {Object.entries(details).map(([key, val]) => (
          <div key={key} className="flex justify-between">
            <span className="text-neutral-500">{key}:</span>
            <span className="font-medium text-neutral-900 dark:text-neutral-100">{val}</span>
          </div>
        ))}
      </div>
      {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
      {isCompleted && <p className="text-green-600 dark:text-green-400 text-xs">Action completed successfully.</p>}
      {!isCompleted && !error && (
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-1.5 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-900 font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-50"
          >
            {isPending ? "Executing..." : "Confirm"}
          </button>
          <button
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
