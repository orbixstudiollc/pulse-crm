"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  SparkleIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
  GearIcon,
  TargetIcon,
  LightningIcon,
  ChartBarIcon,
} from "@/components/ui";
import { useLeadFinderActors } from "@/hooks/use-lead-finder-actors";
import type { ActorDefinition } from "@/lib/lead-finder/apify/registry";

// ── Types ──────────────────────────────────────────────────────────────────

interface KpiDefinition {
  id: string;
  label: string;
  description: string;
  type: "boolean" | "text";
}

interface FieldDefinition {
  id: string;
  label: string;
  description: string;
  type: "text" | "number" | "boolean" | "url";
}

interface AIPlan {
  name: string;
  target_niche: string;
  suggested_actors: string[];
  suggested_search_terms: string[];
  schedule_frequency: string;
  kpi_definitions: KpiDefinition[];
  lead_field_definitions: FieldDefinition[];
}

// ── Step indicator ─────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Describe", icon: SparkleIcon },
  { id: 2, label: "Configure", icon: GearIcon },
  { id: 3, label: "KPIs & Fields", icon: ChartBarIcon },
  { id: 4, label: "Review", icon: CheckCircleIcon },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const isActive = step.id === current;
        const isCompleted = step.id < current;
        return (
          <div key={step.id} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`w-8 h-px ${isCompleted || isActive ? "bg-neutral-300 dark:bg-neutral-600" : "bg-neutral-100 dark:bg-neutral-800"}`}
              />
            )}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-neutral-950 dark:bg-white text-white dark:text-neutral-950"
                  : isCompleted
                    ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
              }`}
            >
              {isCompleted ? (
                <CheckCircleIcon size={14} weight="fill" />
              ) : (
                <Icon size={14} />
              )}
              <span className="hidden sm:inline">{step.label}</span>
              <span className="sm:hidden">{step.id}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Actor config field ─────────────────────────────────────────────────────

function ActorConfigField({
  fieldKey,
  desc,
  value,
  onChange,
}: {
  fieldKey: string;
  desc: { label: string; placeholder: string; type: string; helpText?: string };
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">
        {desc.label}
      </label>
      {desc.type === "string-array" ? (
        <textarea
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={desc.placeholder}
          className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded text-neutral-950 dark:text-neutral-50 text-xs placeholder-neutral-400 dark:placeholder-neutral-500 resize-none focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
        />
      ) : (
        <input
          type={desc.type === "number" ? "number" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={desc.placeholder}
          className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded text-neutral-950 dark:text-neutral-50 text-xs placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
        />
      )}
      {desc.helpText && (
        <p className="mt-1 text-[10px] text-neutral-500 dark:text-neutral-500">{desc.helpText}</p>
      )}
    </div>
  );
}

// ── Type toggle ────────────────────────────────────────────────────────────

function TypeToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded border border-neutral-200 dark:border-neutral-700 overflow-hidden text-[10px]">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2 py-1 transition-colors ${
            value === opt.value
              ? "bg-neutral-950 dark:bg-white text-white dark:text-neutral-950"
              : "bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function NewCampaignPage() {
  const router = useRouter();
  const { allActors } = useLeadFinderActors();
  const [step, setStep] = useState(1);

  // Step 1 state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [aiProvider, setAiProvider] = useState<"openrouter" | "anthropic" | "openai">("anthropic");
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<AIPlan | null>(null);

  // Step 2 state
  const [selectedActors, setSelectedActors] = useState<string[]>([]);
  const [actorConfigs, setActorConfigs] = useState<Record<string, Record<string, string>>>({});
  const [targetNiche, setTargetNiche] = useState("");
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [newSearchTerm, setNewSearchTerm] = useState("");
  const [scheduleFrequency, setScheduleFrequency] = useState("once");
  const [autoEnrich, setAutoEnrich] = useState(true);

  // Step 3 state
  const [kpiDefinitions, setKpiDefinitions] = useState<KpiDefinition[]>([]);
  const [fieldDefinitions, setFieldDefinitions] = useState<FieldDefinition[]>([]);
  const [suggestingFields, setSuggestingFields] = useState(false);

  // Step 4 state
  const [creating, setCreating] = useState(false);

  // ── Detect AI provider from settings ──────────────────────────────────

  useEffect(() => {
    fetch("/api/lead-finder/settings")
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.hasOpenRouter) setAiProvider("openrouter");
        else if (j.data?.hasAnthropic) setAiProvider("anthropic");
      })
      .catch(() => {});
  }, []);

  // ── Build actor summaries for plan endpoint ───────────────────────────

  const buildActorSummaries = useCallback(() => {
    return allActors.map((a: ActorDefinition) => ({
      id: a.id,
      name: a.name,
      phase: a.phase,
      description: a.description,
      inputFieldDescriptions: a.inputFieldDescriptions,
    }));
  }, [allActors]);

  // ── AI Planning ────────────────────────────────────────────────────────

  const handlePlanWithAI = async () => {
    if (!description.trim()) {
      toast.error("Please enter a campaign description first");
      return;
    }
    setPlanning(true);
    try {
      const res = await fetch("/api/lead-finder/campaigns/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          aiProvider,
          actors: buildActorSummaries(),
        }),
      });
      if (!res.ok) throw new Error("Planning failed");
      const json = await res.json();
      const p = json.data as AIPlan;
      setPlan(p);

      // Pre-fill from plan
      if (!name && p.name) setName(p.name);
      setTargetNiche(p.target_niche || "");
      setSearchTerms(p.suggested_search_terms || []);
      setScheduleFrequency(p.schedule_frequency || "once");
      if (p.kpi_definitions?.length) setKpiDefinitions(p.kpi_definitions);
      if (p.lead_field_definitions?.length) setFieldDefinitions(p.lead_field_definitions);

      // Match actors from plan
      if (p.suggested_actors?.length && allActors.length) {
        const matched = allActors
          .filter((a: ActorDefinition) =>
            p.suggested_actors.includes(a.id)
          )
          .map((a: ActorDefinition) => a.id);
        setSelectedActors(matched);
      }

      toast.success("AI plan generated successfully");
      setStep(2);
    } catch {
      toast.error("Failed to generate AI plan");
    } finally {
      setPlanning(false);
    }
  };

  // ── Suggest fields ─────────────────────────────────────────────────────

  const handleSuggestFields = async () => {
    if (!targetNiche) {
      toast.error("Target niche is required");
      return;
    }
    setSuggestingFields(true);
    try {
      const res = await fetch("/api/lead-finder/campaigns/suggest-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetNiche, aiProvider }),
      });
      if (!res.ok) throw new Error("Failed to suggest fields");
      const json = await res.json();
      if (json.data?.kpi_definitions?.length) setKpiDefinitions(json.data.kpi_definitions);
      if (json.data?.lead_field_definitions?.length) setFieldDefinitions(json.data.lead_field_definitions);
      toast.success("Field suggestions generated");
    } catch {
      toast.error("Failed to suggest fields");
    } finally {
      setSuggestingFields(false);
    }
  };

  // ── Actor config handler ───────────────────────────────────────────────

  const updateActorConfig = useCallback(
    (actorId: string, fieldKey: string, value: string) => {
      setActorConfigs((prev) => ({
        ...prev,
        [actorId]: { ...(prev[actorId] || {}), [fieldKey]: value },
      }));
    },
    []
  );

  // ── Toggle actor ───────────────────────────────────────────────────────

  const toggleActor = (actorId: string) => {
    setSelectedActors((prev) =>
      prev.includes(actorId)
        ? prev.filter((id) => id !== actorId)
        : [...prev, actorId]
    );
  };

  // ── Add search term ────────────────────────────────────────────────────

  const addSearchTerm = () => {
    const term = newSearchTerm.trim();
    if (term && !searchTerms.includes(term)) {
      setSearchTerms((prev) => [...prev, term]);
      setNewSearchTerm("");
    }
  };

  // ── KPI management ─────────────────────────────────────────────────────

  const addKpi = () => {
    setKpiDefinitions((prev) => [
      ...prev,
      { id: `kpi_${Date.now()}`, label: "", description: "", type: "boolean" },
    ]);
  };

  const updateKpi = (index: number, field: keyof KpiDefinition, value: string) => {
    setKpiDefinitions((prev) =>
      prev.map((k, i) => (i === index ? { ...k, [field]: value } : k))
    );
  };

  const removeKpi = (index: number) => {
    setKpiDefinitions((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Field management ───────────────────────────────────────────────────

  const addField = () => {
    setFieldDefinitions((prev) => [
      ...prev,
      { id: `field_${Date.now()}`, label: "", description: "", type: "text" },
    ]);
  };

  const updateField = (index: number, field: keyof FieldDefinition, value: string) => {
    setFieldDefinitions((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [field]: value } : f))
    );
  };

  const removeField = (index: number) => {
    setFieldDefinitions((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Create campaign ────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Campaign name is required");
      return;
    }
    if (!targetNiche.trim()) {
      toast.error("Target niche is required");
      return;
    }
    setCreating(true);
    try {
      // Coerce actor configs: string-array fields stored as comma/newline-separated strings
      const coercedActorConfigs: Record<string, Record<string, unknown>> = {};
      for (const actorId of selectedActors) {
        const actorDef = allActors.find((a: ActorDefinition) => a.id === actorId);
        const raw = actorConfigs[actorId] || {};
        const coerced: Record<string, unknown> = { ...(actorDef?.defaultInput || {}) };
        for (const [k, v] of Object.entries(raw)) {
          const fieldDesc = actorDef?.inputFieldDescriptions?.[k];
          if (fieldDesc?.type === "string-array") {
            coerced[k] = v
              .split(/[\n,]+/)
              .map((s: string) => s.trim())
              .filter(Boolean);
          } else if (fieldDesc?.type === "number") {
            coerced[k] = Number(v) || 0;
          } else {
            coerced[k] = v;
          }
        }
        coercedActorConfigs[actorId] = coerced;
      }

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        target_niche: targetNiche.trim(),
        apify_actors: selectedActors,
        actor_configs: coercedActorConfigs,
        kpi_definitions: kpiDefinitions.filter((k) => k.label.trim()),
        lead_field_definitions: fieldDefinitions.filter((f) => f.label.trim()),
        schedule_frequency: scheduleFrequency,
        ai_provider: aiProvider,
        auto_enrich: autoEnrich,
        status: "draft",
      };

      const res = await fetch("/api/lead-finder/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create campaign");
      }
      const json = await res.json();
      toast.success("Campaign created successfully");
      router.push(`/dashboard/lead-finder/campaigns/${json.data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setCreating(false);
    }
  };

  // ── Navigation ─────────────────────────────────────────────────────────

  const canGoNext = () => {
    switch (step) {
      case 1:
        return description.trim().length > 0;
      case 2:
        return targetNiche.trim().length > 0;
      case 3:
        return true;
      default:
        return false;
    }
  };

  // ── Find phase actors ──────────────────────────────────────────────────

  const findActors = allActors.filter((a: ActorDefinition) => a.phase === "find");
  const enrichActors = allActors.filter((a: ActorDefinition) => a.phase === "enrich");

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard/lead-finder/campaigns"
          className="p-2 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors"
        >
          <ArrowLeftIcon size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-neutral-950 dark:text-neutral-50">New Campaign</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Create a lead discovery campaign with AI assistance
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* ── Step 1: Describe ──────────────────────────────────────────── */}
      {step === 1 && (
        <div className="max-w-2xl">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-1.5">
                Campaign Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., SaaS Founders Q1 2026"
                className="w-full px-3 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded text-neutral-950 dark:text-neutral-50 text-sm placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-1.5">
                Campaign Description
              </label>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                Describe what kind of leads you are looking for, your target market, ideal customer profile, and any specific criteria. The more detail you provide, the better the AI plan.
              </p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder="I want to find SaaS founders in the B2B space who have between 10-50 employees, have recently raised a Series A, and are looking for CRM solutions..."
                className="w-full px-3 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded text-neutral-950 dark:text-neutral-50 text-sm placeholder-neutral-400 dark:placeholder-neutral-500 resize-none focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
              />
            </div>

            <button
              onClick={handlePlanWithAI}
              disabled={planning || !description.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {planning ? (
                <>
                  <CircleNotchIcon size={16} className="animate-spin" />
                  Planning with AI...
                </>
              ) : (
                <>
                  <SparkleIcon size={16} />
                  Plan with AI
                </>
              )}
            </button>

            <button
              onClick={() => setStep(2)}
              className="w-full text-center text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors"
            >
              Skip AI planning and configure manually
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Configure ─────────────────────────────────────────── */}
      {step === 2 && (
        <div className="max-w-3xl space-y-6">
          {/* AI plan summary */}
          {plan && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <CheckCircleIcon size={16} weight="fill" className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-green-700 dark:text-green-400">
                <p className="font-semibold mb-0.5">AI Plan Generated</p>
                <p>Target niche: <strong>{plan.target_niche}</strong> · {plan.suggested_actors.length} actors suggested · {plan.suggested_search_terms.length} search terms</p>
              </div>
            </div>
          )}

          {/* Target niche */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 mb-4 flex items-center gap-2">
              <TargetIcon size={16} className="text-neutral-500 dark:text-neutral-400" />
              Target Configuration
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
                  Target Niche
                </label>
                <input
                  type="text"
                  value={targetNiche}
                  onChange={(e) => setTargetNiche(e.target.value)}
                  placeholder="e.g., B2B SaaS Founders, Real Estate Agencies"
                  className="w-full px-3 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded text-neutral-950 dark:text-neutral-50 text-sm placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
                  Search Terms
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {searchTerms.map((term, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-950 dark:text-neutral-50 text-xs"
                    >
                      {term}
                      <button
                        onClick={() =>
                          setSearchTerms((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="text-neutral-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                      >
                        <XIcon size={10} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSearchTerm}
                    onChange={(e) => setNewSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSearchTerm()}
                    placeholder="Add search term..."
                    className="flex-1 px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded text-neutral-950 dark:text-neutral-50 text-sm placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
                  />
                  <button
                    onClick={addSearchTerm}
                    className="px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 text-sm transition-colors"
                  >
                    <PlusIcon size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
                    Schedule
                  </label>
                  <select
                    value={scheduleFrequency}
                    onChange={(e) => setScheduleFrequency(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded text-neutral-950 dark:text-neutral-50 text-sm focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
                  >
                    <option value="once">Run Once</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
                    Auto-enrich
                  </label>
                  <button
                    onClick={() => setAutoEnrich(!autoEnrich)}
                    className={`inline-flex items-center gap-2 h-9 px-3 rounded border text-sm font-medium transition-colors ${
                      autoEnrich
                        ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-950/50"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${autoEnrich ? "bg-green-500" : "bg-neutral-400"}`} />
                    {autoEnrich ? "Auto-enrich on" : "Auto-enrich off"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Actor selection */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 mb-4 flex items-center gap-2">
              <LightningIcon size={16} className="text-neutral-500 dark:text-neutral-400" />
              Discovery Actors
              <span className="text-xs text-neutral-500 dark:text-neutral-400 font-normal">
                ({selectedActors.length} selected)
              </span>
            </h3>

            {allActors.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 dark:text-neutral-400 text-sm">
                <CircleNotchIcon size={20} className="animate-spin mx-auto mb-2" />
                Loading actors...
              </div>
            ) : (
              <div className="space-y-4">
                {findActors.length > 0 && (
                  <div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                      Find Phase
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {findActors.map((actor: ActorDefinition) => {
                        const isSelected = selectedActors.includes(actor.id);
                        return (
                          <button
                            key={actor.id}
                            onClick={() => toggleActor(actor.id)}
                            className={`text-left p-3 rounded-lg border transition-colors ${
                              isSelected
                                ? "bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 text-neutral-950 dark:text-neutral-50"
                                : "bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-500"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">{actor.name}</span>
                              <div
                                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                  isSelected
                                    ? "border-neutral-950 dark:border-white bg-neutral-950 dark:bg-white"
                                    : "border-neutral-300 dark:border-neutral-600"
                                }`}
                              >
                                {isSelected && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-neutral-950" />
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
                              {actor.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {enrichActors.length > 0 && (
                  <div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                      Enrich Phase
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {enrichActors.map((actor: ActorDefinition) => {
                        const isSelected = selectedActors.includes(actor.id);
                        return (
                          <button
                            key={actor.id}
                            onClick={() => toggleActor(actor.id)}
                            className={`text-left p-3 rounded-lg border transition-colors ${
                              isSelected
                                ? "bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 text-neutral-950 dark:text-neutral-50"
                                : "bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-500"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">{actor.name}</span>
                              <div
                                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                  isSelected
                                    ? "border-neutral-950 dark:border-white bg-neutral-950 dark:bg-white"
                                    : "border-neutral-300 dark:border-neutral-600"
                                }`}
                              >
                                {isSelected && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-neutral-950" />
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
                              {actor.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actor configs */}
          {selectedActors.length > 0 && (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 mb-4 flex items-center gap-2">
                <GearIcon size={16} className="text-neutral-500 dark:text-neutral-400" />
                Actor Configuration
              </h3>
              <div className="space-y-6">
                {selectedActors.map((actorId) => {
                  const actor = allActors.find((a: ActorDefinition) => a.id === actorId);
                  if (!actor) return null;
                  const fields = Object.entries(actor.inputFieldDescriptions || {});
                  return (
                    <div
                      key={actorId}
                      className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800"
                    >
                      <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-3">
                        {actor.name}
                      </p>
                      {fields.length > 0 ? (
                        <div className="space-y-3">
                          {fields.map(([fieldKey, desc]) => (
                            <ActorConfigField
                              key={fieldKey}
                              fieldKey={fieldKey}
                              desc={desc}
                              value={actorConfigs[actorId]?.[fieldKey] ?? ""}
                              onChange={(v) => updateActorConfig(actorId, fieldKey, v)}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          No configuration required for this actor.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: KPIs & Fields ─────────────────────────────────────── */}
      {step === 3 && (
        <div className="max-w-3xl space-y-6">
          {/* AI suggest button */}
          <div className="flex justify-end">
            <button
              onClick={handleSuggestFields}
              disabled={suggestingFields || !targetNiche}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 text-sm transition-colors disabled:opacity-50"
            >
              {suggestingFields ? (
                <CircleNotchIcon size={14} className="animate-spin" />
              ) : (
                <SparkleIcon size={14} />
              )}
              Suggest with AI
            </button>
          </div>

          {/* KPI Definitions */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 flex items-center gap-2">
                <ChartBarIcon size={16} className="text-neutral-500 dark:text-neutral-400" />
                KPI Definitions
              </h3>
              <button
                onClick={addKpi}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 text-xs transition-colors"
              >
                <PlusIcon size={12} />
                Add KPI
              </button>
            </div>

            {kpiDefinitions.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">
                No KPIs defined. Add KPIs to score and qualify leads.
              </p>
            ) : (
              <div className="space-y-3">
                {kpiDefinitions.map((kpi, i) => (
                  <div
                    key={i}
                    className="flex gap-3 items-start p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={kpi.label}
                          onChange={(e) => updateKpi(i, "label", e.target.value)}
                          placeholder="KPI Label"
                          className="flex-1 px-2 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded text-neutral-950 dark:text-neutral-50 text-xs focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
                        />
                        <TypeToggle
                          value={kpi.type}
                          options={[
                            { value: "boolean", label: "Yes/No" },
                            { value: "text", label: "Text" },
                          ]}
                          onChange={(v) => updateKpi(i, "type", v)}
                        />
                      </div>
                      <input
                        type="text"
                        value={kpi.description}
                        onChange={(e) => updateKpi(i, "description", e.target.value)}
                        placeholder="Description (e.g., Does the company have more than 10 employees?)"
                        className="w-full px-2 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded text-neutral-950 dark:text-neutral-50 text-xs focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
                      />
                    </div>
                    <button
                      onClick={() => removeKpi(i)}
                      className="p-1 text-neutral-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 transition-colors mt-0.5"
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lead Field Definitions */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 flex items-center gap-2">
                <TargetIcon size={16} className="text-neutral-500 dark:text-neutral-400" />
                Custom Lead Fields
              </h3>
              <button
                onClick={addField}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 text-xs transition-colors"
              >
                <PlusIcon size={12} />
                Add Field
              </button>
            </div>

            {fieldDefinitions.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">
                No custom fields defined. Add fields to capture lead-specific data.
              </p>
            ) : (
              <div className="space-y-3">
                {fieldDefinitions.map((field, i) => (
                  <div
                    key={i}
                    className="flex gap-3 items-start p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => updateField(i, "label", e.target.value)}
                          placeholder="Field Label"
                          className="flex-1 px-2 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded text-neutral-950 dark:text-neutral-50 text-xs focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
                        />
                        <TypeToggle
                          value={field.type}
                          options={[
                            { value: "text", label: "Text" },
                            { value: "number", label: "Num" },
                            { value: "boolean", label: "Bool" },
                            { value: "url", label: "URL" },
                          ]}
                          onChange={(v) => updateField(i, "type", v)}
                        />
                      </div>
                      <input
                        type="text"
                        value={field.description}
                        onChange={(e) => updateField(i, "description", e.target.value)}
                        placeholder="Description (helps AI understand what to extract)"
                        className="w-full px-2 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded text-neutral-950 dark:text-neutral-50 text-xs focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
                      />
                    </div>
                    <button
                      onClick={() => removeField(i)}
                      className="p-1 text-neutral-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 transition-colors mt-0.5"
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 4: Review ────────────────────────────────────────────── */}
      {step === 4 && (
        <div className="max-w-3xl space-y-6">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-5">
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">Campaign Summary</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Name</p>
                <p className="text-sm text-neutral-950 dark:text-neutral-50 font-medium">{name || "Untitled"}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Target Niche</p>
                <p className="text-sm text-neutral-950 dark:text-neutral-50 font-medium">{targetNiche || "Not set"}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">AI Provider</p>
                <p className="text-sm text-neutral-950 dark:text-neutral-50 font-medium capitalize">{aiProvider}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Schedule</p>
                <p className="text-sm text-neutral-950 dark:text-neutral-50 font-medium capitalize">{scheduleFrequency}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Auto-Enrich</p>
                <p className="text-sm text-neutral-950 dark:text-neutral-50 font-medium">{autoEnrich ? "Yes" : "No"}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Actors</p>
                <p className="text-sm text-neutral-950 dark:text-neutral-50 font-medium">{selectedActors.length} selected</p>
              </div>
            </div>

            {/* Search terms */}
            {searchTerms.length > 0 && (
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Search Terms</p>
                <div className="flex flex-wrap gap-1.5">
                  {searchTerms.map((term, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-950 dark:text-neutral-50 text-xs"
                    >
                      {term}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actors list */}
            {selectedActors.length > 0 && (
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Selected Actors</p>
                <div className="space-y-1.5">
                  {selectedActors.map((id) => {
                    const actor = allActors.find((a: ActorDefinition) => a.id === id);
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800"
                      >
                        <LightningIcon size={12} className="text-neutral-500 dark:text-neutral-400" />
                        <span className="text-xs text-neutral-950 dark:text-neutral-50">
                          {actor?.name || id}
                        </span>
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400 capitalize">
                          ({actor?.phase})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* KPIs */}
            {kpiDefinitions.filter((k) => k.label).length > 0 && (
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                  KPIs ({kpiDefinitions.filter((k) => k.label).length})
                </p>
                <div className="space-y-1">
                  {kpiDefinitions
                    .filter((k) => k.label)
                    .map((kpi, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800"
                      >
                        <span className="text-xs text-neutral-950 dark:text-neutral-50">{kpi.label}</span>
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase">
                          {kpi.type}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Fields */}
            {fieldDefinitions.filter((f) => f.label).length > 0 && (
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                  Custom Fields ({fieldDefinitions.filter((f) => f.label).length})
                </p>
                <div className="space-y-1">
                  {fieldDefinitions
                    .filter((f) => f.label)
                    .map((field, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800"
                      >
                        <span className="text-xs text-neutral-950 dark:text-neutral-50">{field.label}</span>
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400 capitalize">
                          {field.type}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Create button */}
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim() || !targetNiche.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? (
              <>
                <CircleNotchIcon size={16} className="animate-spin" />
                Creating campaign...
              </>
            ) : (
              <>
                <CheckCircleIcon size={16} />
                Create Campaign
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Navigation buttons ─────────────────────────────────────────── */}
      {step > 1 && (
        <div className="flex items-center justify-between max-w-3xl pt-2">
          <button
            onClick={() => setStep((s) => s - 1)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-950 dark:text-neutral-50 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <ArrowLeftIcon size={14} />
            Back
          </button>

          {step < 4 && (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canGoNext()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          )}
        </div>
      )}
    </div>
  );
}
