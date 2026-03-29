"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  CheckCircleIcon,
  XCircleIcon,
  CircleNotchIcon,
  LightningIcon,
  SparkleIcon,
  EyeIcon,
  EyeSlashIcon,
  FloppyDiskIcon,
  BuildingsIcon,
} from "@/components/ui";
import { PageHeader } from "@/components/dashboard";
import { Button } from "@/components/ui";
import { LeadFinderSubNav } from "@/components/lead-finder/SubNav";

// ── Types ──────────────────────────────────────────────────────────────────

interface SettingsData {
  apifyKey: string | null;
  anthropicKey: string | null;
  openrouterKey: string | null;
  agencyName: string;
  hasApify: boolean;
  hasAnthropic: boolean;
  hasOpenRouter: boolean;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ApiKeyField({
  label,
  description,
  value,
  onChange,
  hasValue,
  placeholder,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  hasValue: boolean;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="py-4 border-b border-neutral-200 dark:border-neutral-800 last:border-0">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">{label}</span>
            {hasValue && (
              <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-1.5 py-0.5 rounded-full">
                <CheckCircleIcon size={11} weight="fill" />
                Saved
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={hasValue ? "Leave blank to keep current key" : placeholder}
          className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-950 dark:text-neutral-50 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-950 dark:focus:ring-white focus:ring-offset-0 pr-10"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
        >
          {show ? <EyeSlashIcon size={14} /> : <EyeIcon size={14} />}
        </button>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function LeadFinderSettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [apifyKey, setApifyKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [agencyName, setAgencyName] = useState("");

  useEffect(() => {
    fetch("/api/lead-finder/settings")
      .then((r) => r.json())
      .then((j) => {
        const d: SettingsData = j.data;
        setData(d);
        setAgencyName(d?.agencyName ?? "");
      })
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/lead-finder/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apifyKey: apifyKey || undefined,
          anthropicKey: anthropicKey || undefined,
          openrouterKey: openrouterKey || undefined,
          agencyName,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { toast.error(json.error || "Failed to save"); return; }
      toast.success("Settings saved");
      const refreshed = await fetch("/api/lead-finder/settings").then((r) => r.json());
      if (refreshed.data) {
        setData(refreshed.data);
        setApifyKey(""); setAnthropicKey(""); setOpenrouterKey("");
      }
    } catch { toast.error("Failed to save settings"); }
    finally { setSaving(false); }
  }

  const allRequired = data?.hasApify && (data?.hasAnthropic || data?.hasOpenRouter);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <PageHeader title="Lead Finder">
        <Button
          onClick={handleSave}
          disabled={saving}
          leftIcon={saving ? <CircleNotchIcon size={14} className="animate-spin" /> : <FloppyDiskIcon size={14} />}
        >
          Save Changes
        </Button>
      </PageHeader>

      <LeadFinderSubNav />

      {loading && (
        <div className="flex items-center justify-center py-24">
          <CircleNotchIcon size={28} className="animate-spin text-neutral-400" />
        </div>
      )}

      {!loading && (
        <div className="max-w-2xl space-y-6">
          {/* Status banner */}
          <div className={`flex items-start gap-3 p-4 rounded-xl border ${allRequired ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900" : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900"}`}>
            {allRequired
              ? <CheckCircleIcon size={18} weight="fill" className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              : <XCircleIcon size={18} weight="fill" className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />}
            <div>
              <p className={`text-sm font-medium ${allRequired ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>
                {allRequired ? "All required keys configured" : "Missing required API keys"}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {allRequired ? "Lead Finder is ready to discover and enrich leads." : "Add your Apify token and at least one AI provider key below."}
              </p>
            </div>
          </div>

          {/* Apify */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <div className="flex items-center gap-2 mb-1">
              <LightningIcon size={15} className="text-orange-500" />
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">Apify</h2>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">— Lead discovery engine</span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
              Required for running discovery campaigns using Google Maps, LinkedIn, and other scrapers.
            </p>
            <ApiKeyField
              label="Apify API Token"
              description="Get your token at apify.com/account/integrations"
              value={apifyKey}
              onChange={setApifyKey}
              hasValue={data?.hasApify ?? false}
              placeholder="apify_api_..."
            />
          </div>

          {/* AI Provider */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <div className="flex items-center gap-2 mb-1">
              <SparkleIcon size={15} className="text-violet-500" />
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">AI Provider</h2>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">— Enrichment & scoring</span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
              Used for AI-powered lead enrichment, scoring, and personalization. Configure at least one.
            </p>
            <ApiKeyField
              label="Anthropic API Key"
              description="Direct Claude access — console.anthropic.com/settings/keys"
              value={anthropicKey}
              onChange={setAnthropicKey}
              hasValue={data?.hasAnthropic ?? false}
              placeholder="sk-ant-..."
            />
            <ApiKeyField
              label="OpenRouter API Key"
              description="Access GPT-4o and other models — openrouter.ai/keys"
              value={openrouterKey}
              onChange={setOpenrouterKey}
              hasValue={data?.hasOpenRouter ?? false}
              placeholder="sk-or-..."
            />
          </div>

          {/* Agency Profile */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <div className="flex items-center gap-2 mb-1">
              <BuildingsIcon size={15} className="text-blue-500" />
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">Agency Profile</h2>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
              Used to personalize AI-generated outreach and campaign plans.
            </p>
            <div>
              <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 block">Agency / Company Name</label>
              <input
                type="text"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Your agency name"
                className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-950 dark:text-neutral-50 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-950 dark:focus:ring-white"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              leftIcon={saving ? <CircleNotchIcon size={14} className="animate-spin" /> : <FloppyDiskIcon size={14} />}
            >
              Save Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
