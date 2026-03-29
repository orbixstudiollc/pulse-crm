"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  CheckCircleIcon,
  XCircleIcon,
  GearIcon,
  CircleNotchIcon,
  LightningIcon,
  SparkleIcon,
  EyeIcon,
  EyeSlashIcon,
  FloppyDiskIcon,
  BuildingsIcon,
} from "@/components/ui";
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
    <div className="py-4 border-b border-[#232329] last:border-0">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{label}</span>
            {hasValue && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircleIcon size={12} weight="fill" />
                Saved
              </span>
            )}
          </div>
          <p className="text-xs text-[#a0a0a8] mt-0.5">{description}</p>
        </div>
      </div>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={hasValue ? "Leave blank to keep current" : placeholder}
          className="w-full bg-[#0a0a0c] border border-[#232329] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#a0a0a8] focus:outline-none focus:border-[#3a3a42] pr-10"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a0a0a8] hover:text-white transition-colors"
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

  // Form state
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
        setAgencyName(d.agencyName ?? "");
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
      if (!res.ok || json.error) {
        toast.error(json.error || "Failed to save settings");
        return;
      }
      toast.success("Settings saved");

      // Reload to reflect new has* flags
      const refreshed = await fetch("/api/lead-finder/settings").then((r) =>
        r.json()
      );
      if (refreshed.data) {
        setData(refreshed.data);
        // Clear key fields after save (they now show masked)
        setApifyKey("");
        setAnthropicKey("");
        setOpenrouterKey("");
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  const allRequired = data?.hasApify && (data?.hasAnthropic || data?.hasOpenRouter);

  return (
    <div className="min-h-screen bg-[#0a0a0c] p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Lead Finder</h1>
          <p className="text-sm text-[#a0a0a8] mt-1">API keys and configuration</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
        >
          {saving ? (
            <CircleNotchIcon size={14} className="animate-spin" />
          ) : (
            <FloppyDiskIcon size={14} />
          )}
          Save Changes
        </button>
      </div>

      <LeadFinderSubNav />

      {loading && (
        <div className="flex items-center justify-center py-24">
          <CircleNotchIcon size={32} className="animate-spin text-[#a0a0a8]" />
        </div>
      )}

      {!loading && (
        <div className="max-w-2xl space-y-6">
          {/* Status banner */}
          <div
            className={`flex items-start gap-3 p-4 rounded-xl border ${
              allRequired
                ? "bg-emerald-400/5 border-emerald-400/20"
                : "bg-amber-400/5 border-amber-400/20"
            }`}
          >
            {allRequired ? (
              <CheckCircleIcon size={18} weight="fill" className="text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircleIcon size={18} weight="fill" className="text-amber-400 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`text-sm font-medium ${allRequired ? "text-emerald-400" : "text-amber-400"}`}>
                {allRequired ? "All required keys configured" : "Missing required API keys"}
              </p>
              <p className="text-xs text-[#a0a0a8] mt-0.5">
                {allRequired
                  ? "Lead Finder is ready to discover and enrich leads."
                  : "Add your Apify token and at least one AI provider key below."}
              </p>
            </div>
          </div>

          {/* Apify */}
          <div className="bg-[#141417] border border-[#232329] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <LightningIcon size={16} className="text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Apify</h2>
              <span className="text-xs text-[#a0a0a8]">— Lead discovery engine</span>
            </div>
            <p className="text-xs text-[#a0a0a8] mb-3">
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
          <div className="bg-[#141417] border border-[#232329] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <SparkleIcon size={16} className="text-purple-400" />
              <h2 className="text-sm font-semibold text-white">AI Provider</h2>
              <span className="text-xs text-[#a0a0a8]">— Enrichment & scoring</span>
            </div>
            <p className="text-xs text-[#a0a0a8] mb-3">
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
          <div className="bg-[#141417] border border-[#232329] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <BuildingsIcon size={16} className="text-blue-400" />
              <h2 className="text-sm font-semibold text-white">Agency Profile</h2>
            </div>
            <p className="text-xs text-[#a0a0a8] mb-4">
              Used to personalize AI-generated outreach and campaign plans for your agency.
            </p>
            <div>
              <label className="text-xs text-[#a0a0a8] mb-1.5 block">Agency / Company Name</label>
              <input
                type="text"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Your agency name"
                className="w-full bg-[#0a0a0c] border border-[#232329] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#a0a0a8] focus:outline-none focus:border-[#3a3a42]"
              />
            </div>
          </div>

          {/* Save button (bottom) */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <CircleNotchIcon size={14} className="animate-spin" />
              ) : (
                <FloppyDiskIcon size={14} />
              )}
              Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
