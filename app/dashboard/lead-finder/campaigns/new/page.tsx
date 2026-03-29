"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
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

// ── Types ──────────────────────────────────────────────────────────────────

interface Actor {
  id: string;
  actorId: string;
  name: string;
  description: string;
  phase: string;
  requiredInputFields: { key: string; label: string; type: string; placeholder?: string; required?: boolean }[];
  outputFields: string[];
}

interface KpiDefinition {
  key: string;
  label: string;
  description: string;
  type: "boolean" | "text";
}

interface FieldDefinition {
  key: string;
  label: string;
  description: string;
  source: string;
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
                className={`w-8 h-px ${isCompleted || isActive ? "bg-white/40" : "bg-neutral-100 dark:bg-neutral-800"}`}
              />
            )}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white text-black"
                  : isCompleted
                    ? "bg-emerald-400/10 text-green-600 dark:text-green-600 dark:text-green-400"
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

// ── Main component ─────────────────────────────────────────────────────────

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1 state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [aiProvider, setAiProvider] = useState<"anthropic" | "openai">("anthropic");
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<AIPlan | null>(null);

  // Step 2 state
  const [allActors, setAllActors] = useState<Actor[]>([]);
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

  // ── Fetch actors ───────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/lead-finder/actors")
      .then((res) => res.json())
      .then((json) => setAllActors(json.data ?? []))
      .catch(() => toast.error("Failed to load actor registry"));
  }, []);

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
        body: JSON.stringify({ description, aiProvider }),
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
      setKpiDefinitions(p.kpi_definitions || []);
      setFieldDefinitions(p.lead_field_definitions || []);

      // Match actors from plan
      if (p.suggested_actors?.length && allActors.length) {
        const matched = allActors
          .filter((a) => p.suggested_actors.includes(a.actorId) || p.suggested_actors.includes(a.id))
          .map((a) => a.id);
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
      if (json.data?.kpi_definitions) setKpiDefinitions(json.data.kpi_definitions);
      if (json.data?.lead_field_definitions) setFieldDefinitions(json.data.lead_field_definitions);
      toast.success("Field suggestions generated");
    } catch {
      toast.error("Failed to suggest fields");
    } finally {
      setSuggestingFields(false);
    }
  };

  // ── Actor config handler ───────────────────────────────────────────────

  const updateActorConfig = useCallback(
    (actorId: string, key: string, value: string) => {
      setActorConfigs((prev) => ({
        ...prev,
        [actorId]: { ...(prev[actorId] || {}), [key]: value },
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
      { key: `kpi_${Date.now()}`, label: "", description: "", type: "boolean" },
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
      { key: `field_${Date.now()}`, label: "", description: "", source: "mapped" },
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
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        target_niche: targetNiche.trim(),
        apify_actors: selectedActors,
        actor_configs: actorConfigs,
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

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard/lead-finder/campaigns"
          className="p-2 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-white transition-colors"
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
                className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-950 dark:text-neutral-50 text-sm placeholder:text-[#555] focus:outline-none focus:border-[#444]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-1.5">
                Campaign Description
              </label>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                Describe what kind of leads you are looking for, your target
                market, ideal customer profile, and any specific criteria. The
                more detail you provide, the better the AI plan.
              </p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder="I want to find SaaS founders in the B2B space who have between 10-50 employees, have recently raised a Series A, and are looking for CRM solutions..."
                className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-950 dark:text-neutral-50 text-sm placeholder:text-[#555] focus:outline-none focus:border-[#444] resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-1.5">
                AI Provider
              </label>
              <div className="flex gap-3">
                {(["anthropic", "openai"] as const).map((provider) => (
                  <button
                    key={provider}
                    onClick={() => setAiProvider(provider)}
                    className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      aiProvider === provider
                        ? "bg-white text-black border-white"
                        : "bg-neutral-50 dark:bg-neutral-950 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-[#444] hover:text-white"
                    }`}
                  >
                    {provider === "anthropic" ? "Claude (Anthropic)" : "GPT (OpenAI)"}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handlePlanWithAI}
              disabled={planning || !description.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

            {/* Skip planning option */}
            <button
              onClick={() => setStep(2)}
              className="w-full text-center text-xs text-neutral-500 dark:text-neutral-400 hover:text-white transition-colors"
            >
              Skip AI planning and configure manually
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Configure ─────────────────────────────────────────── */}
      {step === 2 && (
        <div className="max-w-3xl space-y-6">
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
                  className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-950 dark:text-neutral-50 text-sm placeholder:text-[#555] focus:outline-none focus:border-[#444]"
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
                        className="text-neutral-500 dark:text-neutral-400 hover:text-red-600 dark:text-red-400"
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
                    className="flex-1 px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-950 dark:text-neutral-50 text-sm placeholder:text-[#555] focus:outline-none focus:border-[#444]"
                  />
                  <button
                    onClick={addSearchTerm}
                    className="px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-white text-sm transition-colors"
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
                    className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-950 dark:text-neutral-50 text-sm focus:outline-none focus:border-[#444]"
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
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      autoEnrich
                        ? "bg-emerald-400/10 text-green-600 dark:text-green-600 dark:text-green-400 border-emerald-400/20"
                        : "bg-neutral-50 dark:bg-neutral-950 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800"
                    }`}
                  >
                    {autoEnrich ? "Enabled" : "Disabled"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Actors selection */}
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
              <div className="space-y-3">
                {/* Group by phase */}
                {["discovery", "enrichment", "scoring"].map((phase) => {
                  const phaseActors = allActors.filter((a) => a.phase === phase);
                  if (phaseActors.length === 0) return null;
                  return (
                    <div key={phase}>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2 capitalize">
                        {phase} Phase
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {phaseActors.map((actor) => {
                          const isSelected = selectedActors.includes(actor.id);
                          return (
                            <button
                              key={actor.id}
                              onClick={() => toggleActor(actor.id)}
                              className={`text-left p-3 rounded-lg border transition-colors ${
                                isSelected
                                  ? "bg-white/5 border-white/20 text-neutral-950 dark:text-neutral-50"
                                  : "bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 hover:border-[#444]"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium">
                                  {actor.name}
                                </span>
                                <div
                                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                    isSelected
                                      ? "border-white bg-white"
                                      : "border-[#444]"
                                  }`}
                                >
                                  {isSelected && (
                                    <CheckCircleIcon
                                      size={10}
                                      className="text-black"
                                      weight="fill"
                                    />
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
                  );
                })}
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
                  const actor = allActors.find((a) => a.id === actorId);
                  if (!actor) return null;
                  return (
                    <div
                      key={actorId}
                      className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800"
                    >
                      <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-3">
                        {actor.name}
                      </p>
                      {actor.requiredInputFields?.length > 0 ? (
                        <div className="space-y-3">
                          {actor.requiredInputFields.map((field) => (
                            <div key={field.key}>
                              <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                                {field.label}
                                {field.required && (
                                  <span className="text-red-600 dark:text-red-400 ml-0.5">*</span>
                                )}
                              </label>
                              <input
                                type={field.type === "number" ? "number" : "text"}
                                value={actorConfigs[actorId]?.[field.key] || ""}
                                onChange={(e) =>
                                  updateActorConfig(actorId, field.key, e.target.value)
                                }
                                placeholder={field.placeholder || ""}
                                className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-950 dark:text-neutral-50 text-sm placeholder:text-[#555] focus:outline-none focus:border-[#444]"
                              />
                            </div>
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
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-white text-sm transition-colors disabled:opacity-50"
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
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-white text-xs transition-colors"
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
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={kpi.label}
                        onChange={(e) => updateKpi(i, "label", e.target.value)}
                        placeholder="KPI Label"
                        className="px-2 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded text-neutral-950 dark:text-neutral-50 text-xs focus:outline-none focus:border-[#444]"
                      />
                      <input
                        type="text"
                        value={kpi.description}
                        onChange={(e) => updateKpi(i, "description", e.target.value)}
                        placeholder="Description"
                        className="px-2 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded text-neutral-950 dark:text-neutral-50 text-xs focus:outline-none focus:border-[#444]"
                      />
                      <select
                        value={kpi.type}
                        onChange={(e) => updateKpi(i, "type", e.target.value)}
                        className="px-2 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded text-neutral-950 dark:text-neutral-50 text-xs focus:outline-none focus:border-[#444]"
                      >
                        <option value="boolean">Boolean (Yes/No)</option>
                        <option value="text">Text</option>
                      </select>
                    </div>
                    <button
                      onClick={() => removeKpi(i)}
                      className="p-1 text-neutral-500 dark:text-neutral-400 hover:text-red-600 dark:text-red-400 transition-colors"
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
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-white text-xs transition-colors"
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
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => updateField(i, "label", e.target.value)}
                        placeholder="Field Label"
                        className="px-2 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded text-neutral-950 dark:text-neutral-50 text-xs focus:outline-none focus:border-[#444]"
                      />
                      <input
                        type="text"
                        value={field.description}
                        onChange={(e) => updateField(i, "description", e.target.value)}
                        placeholder="Description"
                        className="px-2 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded text-neutral-950 dark:text-neutral-50 text-xs focus:outline-none focus:border-[#444]"
                      />
                      <select
                        value={field.source}
                        onChange={(e) => updateField(i, "source", e.target.value)}
                        className="px-2 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded text-neutral-950 dark:text-neutral-50 text-xs focus:outline-none focus:border-[#444]"
                      >
                        <option value="mapped">Mapped Data</option>
                        <option value="enrichment">Enrichment</option>
                        <option value="manual">Manual</option>
                      </select>
                    </div>
                    <button
                      onClick={() => removeField(i)}
                      className="p-1 text-neutral-500 dark:text-neutral-400 hover:text-red-600 dark:text-red-400 transition-colors"
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
                    const actor = allActors.find((a) => a.id === id);
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
                          {field.source}
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
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? (
              <>
                <CircleNotchIcon size={16} className="animate-spin" />
                Creating Campaign...
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

      {/* ── Step navigation ───────────────────────────────────────────── */}
      {step < 4 && (
        <div className="max-w-3xl mt-8 flex items-center justify-between">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 text-sm font-medium hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeftIcon size={14} />
            Back
          </button>
          <button
            onClick={() => setStep(Math.min(4, step + 1))}
            disabled={!canGoNext()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ArrowRightIcon size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
