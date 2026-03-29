"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircleIcon,
  XCircleIcon,
  GearIcon,
  CircleNotchIcon,
  LightningIcon,
  SparkleIcon,
  ArrowSquareOutIcon,
} from "@/components/ui";
import { LeadFinderSubNav } from "@/components/lead-finder/SubNav";

interface EnvStatus {
  apify: { configured: boolean; source: string | null };
  openrouter: { configured: boolean; source: string | null };
  anthropic: { configured: boolean; source: string | null };
  cronSecret: { configured: boolean };
}

function StatusRow({
  label,
  description,
  configured,
  source,
}: {
  label: string;
  description: string;
  configured: boolean;
  source?: string | null;
}) {
  return (
    <div className="flex items-start justify-between py-4 border-b border-[#232329] last:border-0">
      <div className="flex-1 min-w-0 pr-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{label}</span>
          {source && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-[#232329] text-[#a0a0a8]">
              via {source}
            </span>
          )}
        </div>
        <p className="text-xs text-[#a0a0a8] mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {configured ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <CheckCircleIcon size={14} weight="fill" />
            Configured
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-medium text-red-400">
            <XCircleIcon size={14} weight="fill" />
            Not configured
          </span>
        )}
      </div>
    </div>
  );
}

export default function LeadFinderSettingsPage() {
  const [status, setStatus] = useState<EnvStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/lead-finder/settings/env-status")
      .then((r) => r.json())
      .then((j) => setStatus(j.data ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const allConfigured =
    status &&
    status.apify.configured &&
    (status.anthropic.configured || status.openrouter.configured);

  return (
    <div className="min-h-screen bg-[#0a0a0c] p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Lead Finder</h1>
          <p className="text-sm text-[#a0a0a8] mt-1">
            API keys and configuration
          </p>
        </div>
        <Link
          href="/dashboard/settings?tab=ai"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#141417] border border-[#232329] text-white text-sm font-medium hover:bg-[#1a1a1f] transition-colors"
        >
          <GearIcon size={15} />
          Open Settings
          <ArrowSquareOutIcon size={14} className="text-[#a0a0a8]" />
        </Link>
      </div>

      <LeadFinderSubNav />

      <div className="max-w-2xl space-y-6">
        {/* Status banner */}
        {!loading && (
          <div
            className={`flex items-start gap-3 p-4 rounded-xl border ${
              allConfigured
                ? "bg-emerald-400/5 border-emerald-400/20"
                : "bg-amber-400/5 border-amber-400/20"
            }`}
          >
            {allConfigured ? (
              <CheckCircleIcon
                size={18}
                weight="fill"
                className="text-emerald-400 flex-shrink-0 mt-0.5"
              />
            ) : (
              <XCircleIcon
                size={18}
                weight="fill"
                className="text-amber-400 flex-shrink-0 mt-0.5"
              />
            )}
            <div>
              <p
                className={`text-sm font-medium ${allConfigured ? "text-emerald-400" : "text-amber-400"}`}
              >
                {allConfigured
                  ? "All required keys are configured"
                  : "Some API keys are missing"}
              </p>
              <p className="text-xs text-[#a0a0a8] mt-0.5">
                {allConfigured
                  ? "Lead Finder is ready to discover and enrich leads."
                  : "Configure the missing keys in Settings → AI to enable all features."}
              </p>
            </div>
          </div>
        )}

        {/* API key status */}
        <div className="bg-[#141417] border border-[#232329] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <LightningIcon size={16} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Apify</h2>
            <span className="text-xs text-[#a0a0a8]">— Lead discovery engine</span>
          </div>
          <p className="text-xs text-[#a0a0a8] mb-4">
            Required for running discovery campaigns using Google Maps, LinkedIn, and other scrapers.
          </p>

          {loading ? (
            <div className="flex items-center gap-2 text-[#a0a0a8] text-sm py-2">
              <CircleNotchIcon size={14} className="animate-spin" />
              Checking...
            </div>
          ) : (
            <StatusRow
              label="Apify API Token"
              description="Get your token at apify.com/account/integrations"
              configured={status?.apify.configured ?? false}
              source={status?.apify.source}
            />
          )}
        </div>

        <div className="bg-[#141417] border border-[#232329] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <SparkleIcon size={16} className="text-purple-400" />
            <h2 className="text-sm font-semibold text-white">AI Provider</h2>
            <span className="text-xs text-[#a0a0a8]">— Enrichment & scoring</span>
          </div>
          <p className="text-xs text-[#a0a0a8] mb-4">
            Used for AI-powered lead enrichment, scoring, and personalization. Configure at least one.
          </p>

          {loading ? (
            <div className="flex items-center gap-2 text-[#a0a0a8] text-sm py-2">
              <CircleNotchIcon size={14} className="animate-spin" />
              Checking...
            </div>
          ) : (
            <>
              <StatusRow
                label="Anthropic API Key"
                description="Direct Claude access — claude.ai/api"
                configured={status?.anthropic.configured ?? false}
                source={status?.anthropic.source}
              />
              <StatusRow
                label="OpenRouter API Key"
                description="Access GPT-4o and other models — openrouter.ai/keys"
                configured={status?.openrouter.configured ?? false}
                source={status?.openrouter.source}
              />
            </>
          )}
        </div>

        {/* How to configure */}
        {!loading && !allConfigured && (
          <div className="bg-[#141417] border border-[#232329] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-3">
              How to configure
            </h2>
            <ol className="space-y-2 text-sm text-[#a0a0a8]">
              <li className="flex gap-2">
                <span className="text-white font-medium flex-shrink-0">1.</span>
                Go to{" "}
                <Link
                  href="/dashboard/settings?tab=ai"
                  className="text-white underline underline-offset-2 hover:no-underline"
                >
                  Settings → AI
                </Link>
              </li>
              <li className="flex gap-2">
                <span className="text-white font-medium flex-shrink-0">2.</span>
                Add your Apify API token (required for lead discovery)
              </li>
              <li className="flex gap-2">
                <span className="text-white font-medium flex-shrink-0">3.</span>
                Add your Anthropic or OpenRouter key (required for AI enrichment)
              </li>
              <li className="flex gap-2">
                <span className="text-white font-medium flex-shrink-0">4.</span>
                Return here and verify keys are configured
              </li>
            </ol>
          </div>
        )}

        {/* Cron secret */}
        <div className="bg-[#141417] border border-[#232329] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-3">
            Optional: Scheduled Campaigns
          </h2>
          {loading ? (
            <div className="flex items-center gap-2 text-[#a0a0a8] text-sm py-2">
              <CircleNotchIcon size={14} className="animate-spin" />
              Checking...
            </div>
          ) : (
            <StatusRow
              label="CRON_SECRET env var"
              description="Required only for scheduled campaign auto-runs. Set in Vercel environment variables."
              configured={status?.cronSecret.configured ?? false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
