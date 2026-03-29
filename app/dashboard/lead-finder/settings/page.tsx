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
  GearIcon,
  LockIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui";
import { PageHeader } from "@/components/dashboard";
import { Button } from "@/components/ui";
import { LeadFinderSubNav } from "@/components/lead-finder/SubNav";

// ── Types ──────────────────────────────────────────────────────────────────

interface ActorDef {
  id: string;
  name: string;
  phase: "find" | "enrich";
  isCustom?: boolean;
  dbId?: string; // lf_custom_actors row id for delete
}

interface SettingsData {
  apifyKey: string | null;
  anthropicKey: string | null;
  openrouterKey: string | null;
  hasApify: boolean;
  hasAnthropic: boolean;
  hasOpenRouter: boolean;
  defaultModel: string;
  parallelEnrichmentLimit: number;
  agencyName: string;
  agencyType: string;
  agencyDescription: string;
  services: string;
  resultsCaseStudies: string;
  targetIndustries: string;
  agencyWebsite: string;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ApiKeyField({
  label,
  value,
  onChange,
  hasValue,
  placeholder,
  description,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hasValue: boolean;
  placeholder: string;
  description?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-neutral-950 dark:text-neutral-50">{label}</label>
        {hasValue && (
          <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-1.5 py-0.5 rounded-full">
            <CheckCircleIcon size={11} weight="fill" />
            Saved
          </span>
        )}
      </div>
      {description && <p className="text-xs text-neutral-500 dark:text-neutral-400">{description}</p>}
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={hasValue ? "Leave blank to keep current key" : placeholder}
          className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded px-3 py-2.5 text-sm text-neutral-950 dark:text-neutral-50 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-200 dark:focus:border-neutral-700 focus:shadow-focus pr-10"
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

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-0.5">
        {icon}
        <h2 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">{title}</h2>
      </div>
      {subtitle && <p className="text-xs text-neutral-500 dark:text-neutral-400">{subtitle}</p>}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-neutral-950 dark:text-neutral-50 block">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded px-3 py-2.5 text-sm text-neutral-950 dark:text-neutral-50 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-200 dark:focus:border-neutral-700 focus:shadow-focus";
const textareaCls = `${inputCls} resize-none`;

// ── Main ───────────────────────────────────────────────────────────────────

export default function LeadFinderSettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  // API Keys state
  const [apifyKey, setApifyKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [savingKeys, setSavingKeys] = useState(false);

  // Enrichment state
  const [parallelLimit, setParallelLimit] = useState(1);
  const [savingEnrichment, setSavingEnrichment] = useState(false);

  // Agency state
  const [agencyName, setAgencyName] = useState("");
  const [agencyType, setAgencyType] = useState("");
  const [agencyDescription, setAgencyDescription] = useState("");
  const [services, setServices] = useState("");
  const [resultsCaseStudies, setResultsCaseStudies] = useState("");
  const [targetIndustries, setTargetIndustries] = useState("");
  const [agencyWebsite, setAgencyWebsite] = useState("");
  const [savingAgency, setSavingAgency] = useState(false);

  // Actors state
  const [actors, setActors] = useState<ActorDef[]>([]);
  const [showAddActor, setShowAddActor] = useState(false);
  const [newActorId, setNewActorId] = useState("");
  const [newActorName, setNewActorName] = useState("");
  const [newActorPhase, setNewActorPhase] = useState<"find" | "enrich">("find");
  const [savingActor, setSavingActor] = useState(false);

  useEffect(() => {
    fetch("/api/lead-finder/settings")
      .then((r) => r.json())
      .then((j) => {
        const d: SettingsData = j.data;
        setData(d);
        if (d) {
          setParallelLimit(d.parallelEnrichmentLimit ?? 1);
          setAgencyName(d.agencyName ?? "");
          setAgencyType(d.agencyType ?? "");
          setAgencyDescription(d.agencyDescription ?? "");
          setServices(d.services ?? "");
          setResultsCaseStudies(d.resultsCaseStudies ?? "");
          setTargetIndustries(d.targetIndustries ?? "");
          setAgencyWebsite(d.agencyWebsite ?? "");
        }
      })
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));

    fetch("/api/lead-finder/actors")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) setActors(j.data as ActorDef[]);
      })
      .catch(() => {});
  }, []);

  async function save(section: string, payload: Record<string, unknown>, setSaving: (v: boolean) => void) {
    setSaving(true);
    try {
      const res = await fetch("/api/lead-finder/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, ...payload }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { toast.error(json.error || "Failed to save"); return; }
      toast.success("Saved");

      if (section === "keys") {
        // Immediately update hasXxx flags based on what was just saved
        setData((prev) => prev ? {
          ...prev,
          hasApify: prev.hasApify || !!(payload.apifyKey && !String(payload.apifyKey).includes("•")),
          hasAnthropic: prev.hasAnthropic || !!(payload.anthropicKey && !String(payload.anthropicKey).includes("•")),
          hasOpenRouter: prev.hasOpenRouter || !!(payload.openrouterKey && !String(payload.openrouterKey).includes("•")),
        } : prev);
        setApifyKey(""); setAnthropicKey(""); setOpenrouterKey("");
      }

      // Refresh from server to get accurate state (no-store to skip cache)
      const refreshed = await fetch("/api/lead-finder/settings", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (refreshed?.data) setData(refreshed.data);
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  }

  const allRequired = data?.hasApify && (data?.hasAnthropic || data?.hasOpenRouter);

  async function addCustomActor() {
    if (!newActorId.trim() || !newActorName.trim()) { toast.error("Actor ID and name are required"); return; }
    setSavingActor(true);
    try {
      const res = await fetch("/api/lead-finder/actors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: newActorId.trim(), name: newActorName.trim(), phase: newActorPhase }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { toast.error(json.error || "Failed to add actor"); return; }
      toast.success("Actor added");
      setNewActorId(""); setNewActorName(""); setNewActorPhase("find"); setShowAddActor(false);
      const updated = await fetch("/api/lead-finder/actors").then((r) => r.json()).catch(() => null);
      if (updated?.data) setActors(updated.data as ActorDef[]);
    } catch { toast.error("Failed to add actor"); }
    finally { setSavingActor(false); }
  }

  async function deleteCustomActor(actor: ActorDef) {
    if (!actor.dbId) return;
    try {
      const res = await fetch(`/api/lead-finder/actors/${actor.dbId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || json.error) { toast.error(json.error || "Failed to delete"); return; }
      toast.success("Actor removed");
      setActors((prev) => prev.filter((a) => a.dbId !== actor.dbId));
    } catch { toast.error("Failed to delete actor"); }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <PageHeader title="Lead Finder" />

      <LeadFinderSubNav />

      {loading && (
        <div className="flex items-center justify-center py-24">
          <CircleNotchIcon size={28} className="animate-spin text-neutral-400" />
        </div>
      )}

      {!loading && (
        <>
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left column */}
            <div className="space-y-6">

              {/* API Keys */}
              <SectionCard>
                <SectionHeader
                  icon={<LightningIcon size={15} className="text-orange-500" />}
                  title="API Keys"
                  subtitle="Configure your API keys and AI provider"
                />
                <div className="space-y-4">
                  <ApiKeyField
                    label="Apify Token"
                    value={apifyKey}
                    onChange={setApifyKey}
                    hasValue={data?.hasApify ?? false}
                    placeholder="apify_api_..."
                    description="Required for running discovery campaigns"
                  />
                  <ApiKeyField
                    label="Anthropic API Key"
                    value={anthropicKey}
                    onChange={setAnthropicKey}
                    hasValue={data?.hasAnthropic ?? false}
                    placeholder="sk-ant-..."
                    description="console.anthropic.com/settings/keys"
                  />
                  <ApiKeyField
                    label="OpenRouter API Key"
                    value={openrouterKey}
                    onChange={setOpenrouterKey}
                    hasValue={data?.hasOpenRouter ?? false}
                    placeholder="sk-or-..."
                    description="openrouter.ai/keys — access GPT-4o and other models"
                  />
                  <Button
                    className="w-full justify-center"
                    onClick={() => save("keys", { apifyKey, anthropicKey, openrouterKey }, setSavingKeys)}
                    disabled={savingKeys}
                    leftIcon={savingKeys ? <CircleNotchIcon size={14} className="animate-spin" /> : <FloppyDiskIcon size={14} />}
                  >
                    Save API Keys
                  </Button>
                </div>
              </SectionCard>

              {/* Enrichment */}
              <SectionCard>
                <SectionHeader
                  icon={<GearIcon size={15} className="text-blue-500" />}
                  title="Enrichment"
                  subtitle="Configure how leads are enriched across all campaigns"
                />
                <div className="space-y-4">
                  <Field label="Parallel Enrichment Limit">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={parallelLimit}
                      onChange={(e) => setParallelLimit(Number(e.target.value))}
                      className={inputCls}
                    />
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      How many leads to enrich simultaneously. Higher values speed up enrichment but use more Apify credits concurrently. Default: 1 (sequential).
                    </p>
                  </Field>
                  <Button
                    className="w-full justify-center"
                    onClick={() => save("enrichment", { parallelEnrichmentLimit: parallelLimit }, setSavingEnrichment)}
                    disabled={savingEnrichment}
                    leftIcon={savingEnrichment ? <CircleNotchIcon size={14} className="animate-spin" /> : <FloppyDiskIcon size={14} />}
                  >
                    Save Enrichment
                  </Button>
                </div>
              </SectionCard>
            </div>

            {/* Right column — Agency Profile */}
            <div>
              <SectionCard>
                <div className="flex items-start justify-between mb-4">
                  <SectionHeader
                    icon={<BuildingsIcon size={15} className="text-violet-500" />}
                    title="Agency Profile"
                    subtitle="Configure your agency details for lead scoring and enrichment"
                  />
                  <button
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-950/50 transition-colors flex-shrink-0"
                    onClick={() => toast.info("AI generation coming soon")}
                  >
                    <SparkleIcon size={12} />
                    Generate with AI
                  </button>
                </div>
                <div className="space-y-4">
                  <Field label="Agency Name">
                    <input type="text" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="Your agency name" className={inputCls} />
                  </Field>
                  <Field label="Agency Type">
                    <select value={agencyType} onChange={(e) => setAgencyType(e.target.value)} className={inputCls}>
                      <option value="">Select type...</option>
                      <option value="general">General</option>
                      <option value="marketing">Marketing</option>
                      <option value="sales">Sales</option>
                      <option value="design">Design</option>
                      <option value="development">Development</option>
                      <option value="consulting">Consulting</option>
                      <option value="seo">SEO</option>
                      <option value="social_media">Social Media</option>
                      <option value="ai_automation">AI & Automation</option>
                    </select>
                  </Field>
                  <Field label="Agency Description">
                    <textarea
                      rows={3}
                      value={agencyDescription}
                      onChange={(e) => setAgencyDescription(e.target.value)}
                      placeholder="What your agency does, your pitch, unique approach..."
                      className={textareaCls}
                    />
                  </Field>
                  <Field label="Services">
                    <textarea
                      rows={2}
                      value={services}
                      onChange={(e) => setServices(e.target.value)}
                      placeholder="Key services you offer, e.g. voice AI assistants, AI phone handling..."
                      className={textareaCls}
                    />
                  </Field>
                  <Field label="Results & Case Studies">
                    <textarea
                      rows={2}
                      value={resultsCaseStudies}
                      onChange={(e) => setResultsCaseStudies(e.target.value)}
                      placeholder="Case studies, results, social proof, e.g. helped 40+ dental practices automate 80% of calls..."
                      className={textareaCls}
                    />
                  </Field>
                  <Field label="Target Industries">
                    <input
                      type="text"
                      value={targetIndustries}
                      onChange={(e) => setTargetIndustries(e.target.value)}
                      placeholder="e.g. dental, healthcare, real estate, restaurants"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Agency Website">
                    <input
                      type="url"
                      value={agencyWebsite}
                      onChange={(e) => setAgencyWebsite(e.target.value)}
                      placeholder="https://youragency.com"
                      className={inputCls}
                    />
                  </Field>
                  <Button
                    className="w-full justify-center"
                    onClick={() => save("agency", { agencyName, agencyType, agencyDescription, services, resultsCaseStudies, targetIndustries, agencyWebsite }, setSavingAgency)}
                    disabled={savingAgency}
                    leftIcon={savingAgency ? <CircleNotchIcon size={14} className="animate-spin" /> : <FloppyDiskIcon size={14} />}
                  >
                    Save Agency Profile
                  </Button>
                </div>
              </SectionCard>
            </div>
          </div>

          {/* Apify Actors — full width */}
          <SectionCard>
            <div className="flex items-center justify-between mb-4">
              <SectionHeader
                icon={<LightningIcon size={15} className="text-orange-500" />}
                title="Apify Actors"
                subtitle="Manage scrapers and enrichment actors. Custom actors use AI to automatically map output data."
              />
              <button
                onClick={() => setShowAddActor((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-950 dark:bg-neutral-50 text-neutral-50 dark:text-neutral-950 hover:opacity-90 transition-opacity flex-shrink-0"
              >
                <PlusIcon size={12} />
                Add Custom Actor
              </button>
            </div>

            {/* Add actor inline form */}
            {showAddActor && (
              <div className="mb-4 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 space-y-3">
                <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">New Custom Actor</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <input
                      type="text"
                      value={newActorId}
                      onChange={(e) => setNewActorId(e.target.value)}
                      placeholder="e.g. apify/linkedin-scraper"
                      className={inputCls}
                    />
                    <p className="text-xs text-neutral-400 mt-1">Apify actor path</p>
                  </div>
                  <div className="sm:col-span-1">
                    <input
                      type="text"
                      value={newActorName}
                      onChange={(e) => setNewActorName(e.target.value)}
                      placeholder="Display name"
                      className={inputCls}
                    />
                    <p className="text-xs text-neutral-400 mt-1">Name shown in UI</p>
                  </div>
                  <div className="sm:col-span-1">
                    <select
                      value={newActorPhase}
                      onChange={(e) => setNewActorPhase(e.target.value as "find" | "enrich")}
                      className={inputCls}
                    >
                      <option value="find">Find</option>
                      <option value="enrich">Enrich</option>
                    </select>
                    <p className="text-xs text-neutral-400 mt-1">Phase</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={addCustomActor}
                    disabled={savingActor}
                    leftIcon={savingActor ? <CircleNotchIcon size={13} className="animate-spin" /> : <PlusIcon size={13} />}
                  >
                    Add Actor
                  </Button>
                  <button
                    onClick={() => setShowAddActor(false)}
                    className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Actor list */}
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {actors.length === 0 && (
                <p className="text-sm text-neutral-400 py-4 text-center">No actors loaded.</p>
              )}
              {actors.map((actor) => (
                <div key={actor.id} className="flex items-center gap-3 py-3">
                  <LockIcon size={14} className="text-neutral-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50 truncate">{actor.name}</p>
                    <p className="text-xs text-neutral-400 truncate">{actor.id}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0 ${
                    actor.phase === "find"
                      ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                      : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                  }`}>
                    {actor.phase === "find" ? "Find" : "Enrich"}
                  </span>
                  {actor.isCustom && actor.dbId && (
                    <button
                      onClick={() => deleteCustomActor(actor)}
                      className="p-1 text-neutral-400 hover:text-red-500 dark:hover:text-red-400 transition-colors flex-shrink-0"
                      title="Remove actor"
                    >
                      <TrashIcon size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
