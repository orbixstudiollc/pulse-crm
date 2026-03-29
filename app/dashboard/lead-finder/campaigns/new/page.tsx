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
  PencilSimpleIcon,
  MagnifyingGlassIcon,
  HardDrivesIcon,
  HashIcon,
  LinkIcon,
  TextTIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
  Input,
  Select,
  Textarea,
  Button,
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
  suggested_actor_configs?: Record<string, Record<string, string>>;
  schedule_frequency: string;
  reasoning?: string;
  auto_enrich?: boolean;
  kpi_definitions: KpiDefinition[];
  lead_field_definitions: FieldDefinition[];
}

// ── Step indicator ─────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Describe", icon: SparkleIcon },
  { id: 2, label: "Actors", icon: LightningIcon },
  { id: 3, label: "Fields & KPIs", icon: HardDrivesIcon },
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
  desc: { label: string; placeholder?: string; type: string; helpText?: string };
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mb-1">
        {desc.label}
        <PencilSimpleIcon size={10} className="text-neutral-400 dark:text-neutral-500" />
      </label>
      {desc.type === "boolean" ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(value === "true" ? "false" : "true")}
          className={`text-xs ${
            value === "true"
              ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
              : ""
          }`}
          leftIcon={<span className={`w-1.5 h-1.5 rounded-full ${value === "true" ? "bg-green-500" : "bg-neutral-400"}`} />}
        >
          {value === "true" ? "Yes" : "No"}
        </Button>
      ) : desc.type === "string-array" ? (
        <Textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={desc.placeholder}
          className="text-xs py-2"
        />
      ) : (
        <Input
          type={desc.type === "number" ? "number" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={desc.placeholder}
          className="text-xs py-2"
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
  options: { value: T; label: string; icon?: React.ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded border border-neutral-200 dark:border-neutral-700 overflow-hidden text-[10px]">
      {options.map((opt) => (
        <Button
          key={opt.value}
          variant={value === opt.value ? "primary" : "ghost"}
          onClick={() => onChange(opt.value)}
          className={`rounded-none h-auto px-2 py-1 text-[10px] gap-1 ${
            value !== opt.value
              ? "bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50"
              : ""
          }`}
          leftIcon={opt.icon}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function NewCampaignPage() {
  const router = useRouter();
  const { allActors, getActorById, getActorsByPhase } = useLeadFinderActors();
  const [step, setStep] = useState(1);

  // Step 1 state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [aiProvider, setAiProvider] = useState<"openrouter" | "anthropic" | "openai">("anthropic");
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<AIPlan | null>(null);

  // Step 2 state
  const [selectedActors, setSelectedActors] = useState<Set<string>>(new Set());
  const [editableActorConfigs, setEditableActorConfigs] = useState<Record<string, Record<string, string>>>({});
  const [editableNiche, setEditableNiche] = useState("");
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [newSearchTerm, setNewSearchTerm] = useState("");
  const [editableSchedule, setEditableSchedule] = useState("once");
  const [editableAutoEnrich, setEditableAutoEnrich] = useState(true);

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

  // ── Actor lists ───────────────────────────────────────────────────────

  const findActors = getActorsByPhase("find");
  const enrichActors = getActorsByPhase("enrich");

  // ── Build actor summaries for plan endpoint ───────────────────────────

  const buildActorSummaries = useCallback(() => {
    return allActors.map((a: ActorDefinition) => ({
      id: a.id,
      name: a.name,
      phase: a.phase,
      description: a.description,
      fields: Object.keys(a.inputFieldDescriptions || {}).map((key) => {
        const desc = a.inputFieldDescriptions?.[key];
        return {
          key,
          label: desc?.label || key,
          type: desc?.type || "string",
          helpText: desc?.helpText,
        };
      }),
    }));
  }, [allActors]);

  // ── AI Planning (Step 1 → Step 2) ────────────────────────────────────

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
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Planning failed");
      }
      const json = await res.json();
      const p = json.data as AIPlan;
      setPlan(p);

      // Pre-fill from plan
      if (!name && p.name) setName(p.name);
      setEditableNiche(p.target_niche || "");
      setSearchTerms(p.suggested_search_terms || []);
      setEditableSchedule(p.schedule_frequency || "once");
      if (p.auto_enrich !== undefined) setEditableAutoEnrich(p.auto_enrich);
      if (p.kpi_definitions?.length) setKpiDefinitions(p.kpi_definitions);
      if (p.lead_field_definitions?.length) setFieldDefinitions(p.lead_field_definitions);

      // Initialize actor configs from AI suggestions
      const initConfigs: Record<string, Record<string, string>> = {};
      if (p.suggested_actor_configs) {
        for (const [actorId, fields] of Object.entries(p.suggested_actor_configs)) {
          initConfigs[actorId] = {};
          for (const [key, val] of Object.entries(fields)) {
            initConfigs[actorId][key] = String(val);
          }
        }
      }
      // Ensure all actors have config entries
      for (const actor of allActors) {
        if (!initConfigs[actor.id]) {
          initConfigs[actor.id] = {};
        }
      }
      setEditableActorConfigs(initConfigs);

      // Pre-select suggested actors
      if (p.suggested_actors?.length) {
        const matched = new Set(
          allActors
            .filter((a: ActorDefinition) => p.suggested_actors.includes(a.id))
            .map((a: ActorDefinition) => a.id)
        );
        setSelectedActors(matched);
      }

      toast.success("AI plan generated successfully");
      setStep(2);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate AI plan");
    } finally {
      setPlanning(false);
    }
  };

  // ── Toggle actor ───────────────────────────────────────────────────────

  const toggleActor = (actorId: string) => {
    setSelectedActors((prev) => {
      const next = new Set(prev);
      if (next.has(actorId)) {
        next.delete(actorId);
      } else {
        next.add(actorId);
      }
      return next;
    });
  };

  // ── Set actor field value ─────────────────────────────────────────────

  const setActorFieldValue = (actorId: string, field: string, value: string) => {
    setEditableActorConfigs((prev) => ({
      ...prev,
      [actorId]: { ...(prev[actorId] || {}), [field]: value },
    }));
  };

  // ── Build final actor configs (coerced types) ─────────────────────────

  const buildActorConfigs = (): Record<string, Record<string, unknown>> => {
    const configs: Record<string, Record<string, unknown>> = {};
    for (const actorId of selectedActors) {
      const actorDef = getActorById(actorId);
      if (!actorDef) continue;

      const input: Record<string, unknown> = { ...(actorDef.defaultInput || {}) };
      const editedFields = editableActorConfigs[actorId] || {};

      for (const [fieldName, rawValue] of Object.entries(editedFields)) {
        const desc = actorDef.inputFieldDescriptions?.[fieldName];
        if (!rawValue.trim()) continue;

        if (desc?.type === "boolean") {
          input[fieldName] = rawValue === "true";
        } else if (desc?.type === "string-array") {
          input[fieldName] = rawValue.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
        } else if (desc?.type === "number") {
          input[fieldName] = Number(rawValue) || 0;
        } else {
          input[fieldName] = rawValue;
        }
      }
      configs[actorId] = input;
    }
    return configs;
  };

  // ── Go to Step 3: auto-suggest fields ─────────────────────────────────

  const handleGoToStep3 = async () => {
    const selectedFindActors = [...selectedActors].filter((id) => {
      const a = getActorById(id);
      return a && a.phase === "find";
    });
    if (selectedFindActors.length === 0) {
      toast.error("Select at least one Find actor to discover leads");
      return;
    }
    setStep(3);

    // Auto-suggest fields if none exist yet
    if (fieldDefinitions.length > 0 && kpiDefinitions.length > 0) return;

    setSuggestingFields(true);
    try {
      const res = await fetch("/api/lead-finder/campaigns/suggest-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetNiche: editableNiche || description,
          aiProvider,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data?.lead_field_definitions?.length && fieldDefinitions.length === 0) {
          setFieldDefinitions(json.data.lead_field_definitions);
        }
        if (json.data?.kpi_definitions?.length && kpiDefinitions.length === 0) {
          setKpiDefinitions(json.data.kpi_definitions);
        }
      }
    } catch {
      // non-blocking
    } finally {
      setSuggestingFields(false);
    }
  };

  // ── Manual field suggestion ───────────────────────────────────────────

  const handleSuggestFields = async () => {
    if (!editableNiche) {
      toast.error("Target niche is required to suggest fields");
      return;
    }
    setSuggestingFields(true);
    try {
      const res = await fetch("/api/lead-finder/campaigns/suggest-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetNiche: editableNiche, aiProvider }),
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
    if (!editableNiche.trim()) {
      toast.error("Target niche is required");
      return;
    }
    setCreating(true);
    try {
      const actorConfigs = buildActorConfigs();
      const allSelectedActors = [...selectedActors];

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        target_niche: editableNiche.trim(),
        apify_actors: allSelectedActors,
        actor_configs: actorConfigs,
        kpi_definitions: kpiDefinitions.filter((k) => k.label.trim()),
        lead_field_definitions: fieldDefinitions.filter((f) => f.label.trim()),
        schedule_frequency: editableSchedule,
        ai_provider: aiProvider,
        auto_enrich: editableAutoEnrich,
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

  // ── Actor card renderer ────────────────────────────────────────────────

  const renderActorCard = (actor: ActorDefinition, isSelected: boolean) => {
    const fields = editableActorConfigs[actor.id] || {};
    const fieldDescriptions = Object.entries(actor.inputFieldDescriptions || {});

    return (
      <div
        key={actor.id}
        className={`rounded-lg border-2 transition-colors ${
          isSelected
            ? "border-neutral-400 dark:border-neutral-500 bg-neutral-50 dark:bg-neutral-800/50"
            : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
        }`}
      >
        <div
          className="flex cursor-pointer items-center gap-3 p-4"
          onClick={() => toggleActor(actor.id)}
        >
          <div
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
              isSelected
                ? "border-neutral-950 dark:border-white bg-neutral-950 dark:bg-white"
                : "border-neutral-300 dark:border-neutral-600"
            }`}
          >
            {isSelected && (
              <CheckCircleIcon size={12} weight="fill" className="text-white dark:text-neutral-950" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
              {actor.name}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {actor.description}
            </p>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-medium border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 capitalize">
            {actor.category}
          </span>
        </div>

        {/* Show config fields when selected (only for find actors with input fields) */}
        {isSelected && fieldDescriptions.length > 0 && (
          <div className="border-t border-neutral-200 dark:border-neutral-800 px-4 pb-4 pt-3 space-y-3">
            {fieldDescriptions.map(([fieldName, desc]) => (
              <ActorConfigField
                key={fieldName}
                fieldKey={fieldName}
                desc={desc}
                value={fields[fieldName] || ""}
                onChange={(v) => setActorFieldValue(actor.id, fieldName, v)}
              />
            ))}
          </div>
        )}

        {/* For enrichment actors, show auto-fill note */}
        {isSelected && fieldDescriptions.length === 0 && (
          <div className="border-t border-neutral-200 dark:border-neutral-800 px-4 py-2.5">
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
              Inputs filled automatically from lead data during enrichment
            </p>
          </div>
        )}
      </div>
    );
  };

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
          <h1 className="text-xl font-bold text-neutral-950 dark:text-neutral-50">
            New Campaign
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {step === 1
              ? "Describe what leads you want to find"
              : step === 2
                ? "Configure actors and campaign settings"
                : step === 3
                  ? "Configure lead data fields and KPIs"
                  : "Review and create your campaign"}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* ── Step 1: Describe + AI Plan ───────────────────────────────────── */}
      {step === 1 && (
        <div className="max-w-2xl">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-5">
            <Input
              label="Campaign Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Miami Dentists Q1 2026"
            />

            <div>
              <Textarea
                label="What leads do you want to find?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder="Find dentists and orthodontists in Miami FL. I need their email addresses, phone numbers, and websites. Focus on practices with good ratings that might need help with their online presence."
              />
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">
                Describe in plain English what you are looking for. Be specific about the
                business type, location, and what information you need. AI will generate
                search terms, select actors, and configure the campaign for you.
              </p>
            </div>

            <Button
              variant="primary"
              size="lg"
              onClick={handlePlanWithAI}
              disabled={planning || !description.trim()}
              className="w-full"
              leftIcon={planning ? <CircleNotchIcon size={16} className="animate-spin" /> : <SparkleIcon size={16} />}
            >
              {planning ? "AI is analyzing your campaign..." : "Plan Campaign with AI"}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(2)}
              className="w-full text-xs"
            >
              Skip AI planning and configure manually
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Actors + Campaign Settings ───────────────────────────── */}
      {step === 2 && (
        <div className="max-w-3xl space-y-6">
          {/* AI Reasoning / Plan summary */}
          {plan && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <SparkleIcon size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <p className="font-semibold text-green-700 dark:text-green-400 mb-0.5">
                  AI Recommendation
                </p>
                {plan.reasoning ? (
                  <p className="text-green-700 dark:text-green-400 mb-2">{plan.reasoning}</p>
                ) : (
                  <p className="text-green-700 dark:text-green-400 mb-2">
                    Target niche: <strong>{plan.target_niche}</strong> &middot;{" "}
                    {plan.suggested_actors.length} actors suggested &middot;{" "}
                    {plan.suggested_search_terms.length} search terms
                  </p>
                )}
                {searchTerms.length > 0 && (
                  <div>
                    <p className="text-green-600 dark:text-green-500 font-medium mb-1.5">
                      Suggested search terms (pre-filled in actors below):
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {searchTerms.map((term, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300 text-[10px]"
                        >
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Campaign Settings */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 mb-4 flex items-center gap-2">
              <TargetIcon size={16} className="text-neutral-500 dark:text-neutral-400" />
              Campaign Settings
            </h3>
            <div className="space-y-4">
              <Input
                label="Target Niche"
                type="text"
                value={editableNiche}
                onChange={(e) => setEditableNiche(e.target.value)}
                placeholder="e.g., B2B SaaS Founders, Miami Dentists"
              />

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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setSearchTerms((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="p-0 h-auto text-neutral-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                      >
                        <XIcon size={10} />
                      </Button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={newSearchTerm}
                    onChange={(e) => setNewSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSearchTerm()}
                    placeholder="Add search term..."
                    className="flex-1"
                  />
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={addSearchTerm}
                  >
                    <PlusIcon size={14} />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Schedule"
                  value={editableSchedule}
                  onChange={(e) => setEditableSchedule(e.target.value)}
                  options={[
                    { label: "Run Once", value: "once" },
                    { label: "Daily", value: "daily" },
                    { label: "Weekly", value: "weekly" },
                    { label: "Bi-weekly", value: "biweekly" },
                    { label: "Monthly", value: "monthly" },
                  ]}
                />
                <div>
                  <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
                    Auto-Enrich Leads
                  </label>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => setEditableAutoEnrich(!editableAutoEnrich)}
                    className={
                      editableAutoEnrich
                        ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-950/50"
                        : ""
                    }
                    leftIcon={
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${editableAutoEnrich ? "bg-green-500" : "bg-neutral-400"}`}
                      />
                    }
                  >
                    {editableAutoEnrich ? "Enabled" : "Disabled"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Find Leads - Discovery Actors */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 mb-1 flex items-center gap-2">
              <MagnifyingGlassIcon size={16} className="text-neutral-500 dark:text-neutral-400" />
              Step 1 -- Find Leads
              <span className="text-xs text-neutral-500 dark:text-neutral-400 font-normal">
                ({[...selectedActors].filter((id) => {
                  const a = getActorById(id);
                  return a?.phase === "find";
                }).length} selected)
              </span>
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
              Select which tools to use for discovering leads. These run first to find
              businesses matching your criteria.
            </p>

            {allActors.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 dark:text-neutral-400 text-sm">
                <CircleNotchIcon size={20} className="animate-spin mx-auto mb-2" />
                Loading actors...
              </div>
            ) : (
              <div className="space-y-3">
                {findActors.map((actor) =>
                  renderActorCard(actor, selectedActors.has(actor.id))
                )}
              </div>
            )}
          </div>

          {/* Enrich Leads - Enrichment Actors */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 mb-1 flex items-center gap-2">
              <LightningIcon size={16} className="text-neutral-500 dark:text-neutral-400" />
              Step 2 -- Enrich Leads
              <span className="text-xs text-neutral-500 dark:text-neutral-400 font-normal">
                ({[...selectedActors].filter((id) => {
                  const a = getActorById(id);
                  return a?.phase === "enrich";
                }).length} selected)
              </span>
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
              Select which tools to use for enriching leads with additional data.
              {editableAutoEnrich
                ? " Enrichment runs automatically after discovery."
                : " Enrichment can be triggered manually from the campaign page."}
            </p>

            <div className="space-y-3">
              {enrichActors.map((actor) =>
                renderActorCard(actor, selectedActors.has(actor.id))
              )}
            </div>
          </div>

          {/* Next button */}
          <Button
            variant="primary"
            size="lg"
            onClick={handleGoToStep3}
            disabled={selectedActors.size === 0}
            className="w-full"
          >
            Next: Configure Fields & KPIs
          </Button>
        </div>
      )}

      {/* ── Step 3: Lead Fields + KPIs ───────────────────────────────────── */}
      {step === 3 && (
        <div className="max-w-3xl space-y-6">
          {/* AI suggest button */}
          <div className="flex justify-end">
            <Button
              variant="secondary"
              size="md"
              onClick={handleSuggestFields}
              disabled={suggestingFields || !editableNiche}
              leftIcon={suggestingFields ? <CircleNotchIcon size={14} className="animate-spin" /> : <SparkleIcon size={14} />}
            >
              Re-suggest with AI
            </Button>
          </div>

          {/* Lead Data Fields */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 flex items-center gap-2">
                <HardDrivesIcon size={16} className="text-neutral-500 dark:text-neutral-400" />
                Lead Data Fields
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={addField}
                leftIcon={<PlusIcon size={12} />}
              >
                Add Field
              </Button>
            </div>

            {suggestingFields ? (
              <div className="flex items-center justify-center py-8 gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                <CircleNotchIcon size={16} className="animate-spin" />
                AI is analyzing your actors to suggest relevant fields...
              </div>
            ) : fieldDefinitions.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-6">
                No additional lead fields configured. Click &quot;Add Field&quot; to track
                extra data per lead.
              </p>
            ) : (
              <div className="space-y-3">
                {fieldDefinitions.map((field, i) => (
                  <div
                    key={field.id}
                    className="flex gap-3 items-start p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          value={field.label}
                          onChange={(e) => updateField(i, "label", e.target.value)}
                          placeholder="Field label, e.g. Instagram Handle"
                          className="flex-1 text-xs font-medium py-1.5 px-2"
                        />
                        <TypeToggle
                          value={field.type}
                          options={[
                            { value: "text", label: "Text", icon: <TextTIcon size={10} /> },
                            { value: "number", label: "Num", icon: <HashIcon size={10} /> },
                            { value: "boolean", label: "Bool", icon: <ToggleRightIcon size={10} /> },
                            { value: "url", label: "URL", icon: <LinkIcon size={10} /> },
                          ]}
                          onChange={(v) => updateField(i, "type", v)}
                        />
                      </div>
                      <Input
                        type="text"
                        value={field.description}
                        onChange={(e) => updateField(i, "description", e.target.value)}
                        placeholder="Description (helps AI understand what to extract)"
                        className="text-xs py-1.5 px-2"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeField(i)}
                      className="p-1 h-auto text-neutral-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 mt-0.5"
                    >
                      <TrashIcon size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* KPI Definitions */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 flex items-center gap-2">
                <ChartBarIcon size={16} className="text-neutral-500 dark:text-neutral-400" />
                Lead KPIs to Track
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={addKpi}
                leftIcon={<PlusIcon size={12} />}
              >
                Add KPI
              </Button>
            </div>

            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
              These KPIs will be automatically filled by AI during lead enrichment. You
              can edit them per-lead later.
            </p>

            {kpiDefinitions.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-6">
                No KPIs configured. Click &quot;Add KPI&quot; to track custom metrics for
                your leads.
              </p>
            ) : (
              <div className="space-y-3">
                {kpiDefinitions.map((kpi, i) => (
                  <div
                    key={kpi.id}
                    className="flex gap-3 items-start p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          value={kpi.label}
                          onChange={(e) => updateKpi(i, "label", e.target.value)}
                          placeholder="KPI label, e.g. Has online booking"
                          className="flex-1 text-xs font-medium py-1.5 px-2"
                        />
                        <TypeToggle
                          value={kpi.type}
                          options={[
                            { value: "boolean", label: "Yes/No", icon: <ToggleLeftIcon size={10} /> },
                            { value: "text", label: "Text", icon: <TextTIcon size={10} /> },
                          ]}
                          onChange={(v) => updateKpi(i, "type", v)}
                        />
                      </div>
                      <Input
                        type="text"
                        value={kpi.description}
                        onChange={(e) => updateKpi(i, "description", e.target.value)}
                        placeholder="Description (e.g., Does the company have more than 10 employees?)"
                        className="text-xs py-1.5 px-2"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeKpi(i)}
                      className="p-1 h-auto text-neutral-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 mt-0.5"
                    >
                      <TrashIcon size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Next button */}
          <Button
            variant="primary"
            size="lg"
            onClick={() => setStep(4)}
            className="w-full"
          >
            Next: Review & Create
          </Button>
        </div>
      )}

      {/* ── Step 4: Review & Create ──────────────────────────────────────── */}
      {step === 4 && (
        <div className="max-w-3xl space-y-6">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-5">
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
              Campaign Summary
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Name</p>
                <p className="text-sm text-neutral-950 dark:text-neutral-50 font-medium">
                  {name || "Untitled"}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  Target Niche
                </p>
                <p className="text-sm text-neutral-950 dark:text-neutral-50 font-medium">
                  {editableNiche || "Not set"}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  AI Provider
                </p>
                <p className="text-sm text-neutral-950 dark:text-neutral-50 font-medium capitalize">
                  {aiProvider}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  Schedule
                </p>
                <p className="text-sm text-neutral-950 dark:text-neutral-50 font-medium capitalize">
                  {editableSchedule}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  Auto-Enrich
                </p>
                <p className="text-sm text-neutral-950 dark:text-neutral-50 font-medium">
                  {editableAutoEnrich ? "Yes" : "No"}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  Actors
                </p>
                <p className="text-sm text-neutral-950 dark:text-neutral-50 font-medium">
                  {selectedActors.size} selected
                </p>
              </div>
            </div>

            {/* Search terms */}
            {searchTerms.length > 0 && (
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                  Search Terms
                </p>
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
            {selectedActors.size > 0 && (
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                  Selected Actors
                </p>
                <div className="space-y-1.5">
                  {[...selectedActors].map((id) => {
                    const actor = getActorById(id);
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800"
                      >
                        <LightningIcon
                          size={12}
                          className="text-neutral-500 dark:text-neutral-400"
                        />
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
                        <span className="text-xs text-neutral-950 dark:text-neutral-50">
                          {kpi.label}
                        </span>
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
                        <span className="text-xs text-neutral-950 dark:text-neutral-50">
                          {field.label}
                        </span>
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
          <Button
            variant="primary"
            size="lg"
            onClick={handleCreate}
            disabled={creating || !name.trim() || !editableNiche.trim()}
            className="w-full"
            leftIcon={creating ? <CircleNotchIcon size={16} className="animate-spin" /> : <CheckCircleIcon size={16} />}
          >
            {creating
              ? "Creating campaign..."
              : `Create Campaign${kpiDefinitions.filter((k) => k.label).length > 0 ? ` with ${kpiDefinitions.filter((k) => k.label).length} KPI${kpiDefinitions.filter((k) => k.label).length > 1 ? "s" : ""}` : ""}`}
          </Button>
        </div>
      )}

      {/* ── Navigation buttons ─────────────────────────────────────────── */}
      {step > 1 && (
        <div className="flex items-center justify-between max-w-3xl pt-2">
          <Button
            variant="outline"
            size="md"
            onClick={() => setStep((s) => s - 1)}
            leftIcon={<ArrowLeftIcon size={14} />}
          >
            Back
          </Button>
        </div>
      )}
    </div>
  );
}
