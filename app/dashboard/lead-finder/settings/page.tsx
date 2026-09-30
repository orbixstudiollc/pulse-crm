"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
  MagnifyingGlassIcon,
  FileTextIcon,
} from "@/components/ui";
import { Page, PageHeader, PageTabs, Section, TableSection } from "@/components/dashboard";
import { Button } from "@/components/ui";
import { LeadFinderSubNav } from "@/components/lead-finder/SubNav";

// ── Types ──────────────────────────────────────────────────────────────────

interface ActorDef {
  id: string;
  name: string;
  phase: "find" | "enrich";
  category?: string;
  isCustom?: boolean;
  dbId?: string;
}

// Shape returned by GET /api/lead-finder/settings. Field names mirror the
// server response (snake_case) so we never silently drop saves due to a
// client/server naming drift.
interface SettingsData {
  apify_token: string;
  anthropic_api_key: string;
  openrouter_api_key: string;
  openai_api_key: string;
  groq_api_key: string;
  ollama_base_url: string;
  openrouter_oauth_active: boolean;
  has_apify: boolean;
  has_anthropic: boolean;
  has_openrouter: boolean;
  has_openai: boolean;
  has_groq: boolean;
  has_ollama: boolean;
  ai_provider: string;
  ai_model: string;
  enrichment_concurrency: string;
  agency_name: string;
  agency_type: string;
  agency_description: string;
  agency_services: string;
  agency_results: string;
  agency_target_industries: string;
  agency_website: string;
  obsidian_sync_enabled: boolean;
}

type TabId =
  | "providers"
  | "agency"
  | "actors"
  | "enrichment"
  | "obsidian";

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
        <label className="text-sm font-medium text-fg">
          {label}
        </label>
        {hasValue ? (
          <span className="inline-flex items-center gap-1 text-xs text-success bg-success-surface px-1.5 py-0.5 rounded-full">
            <CheckCircleIcon size={11} weight="fill" />
            Configured
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-fg-secondary bg-muted px-1.5 py-0.5 rounded-full">
            Missing
          </span>
        )}
      </div>
      {description && (
        <p className="text-xs text-fg-secondary">
          {description}
        </p>
      )}
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={hasValue ? "Leave blank to keep current key" : placeholder}
          className="w-full bg-surface border border-line rounded px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-line focus:shadow-focus pr-10"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg-secondary transition-colors"
        >
          {show ? <EyeSlashIcon size={14} /> : <EyeIcon size={14} />}
        </button>
      </div>
    </div>
  );
}

function SectionCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <Section className={className}>{children}</Section>;
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-[16px] leading-6 font-semibold text-fg">
          {title}
        </h2>
      </div>
      {subtitle && (
        <p className="mt-0.5 text-[13px] text-fg-muted">
          {subtitle}
        </p>
      )}
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
      <label className="text-sm font-medium text-fg block">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full bg-surface border border-line rounded px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-line focus:shadow-focus";
const textareaCls = `${inputCls} resize-none`;

// ── Main ───────────────────────────────────────────────────────────────────

function LeadFinderSettingsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("providers");
  const [envStatus, setEnvStatus] = useState<Record<string, { configured: boolean }> | null>(null);

  // Provider keys state (blank means "keep existing")
  const [apifyKey, setApifyKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("");
  const [aiProvider, setAiProvider] = useState("openrouter");
  const [aiModel, setAiModel] = useState("");
  const [savingKeys, setSavingKeys] = useState(false);

  // Enrichment
  const [parallelLimit, setParallelLimit] = useState(1);
  const [savingEnrichment, setSavingEnrichment] = useState(false);

  // Agency
  const [agencyName, setAgencyName] = useState("");
  const [agencyType, setAgencyType] = useState("");
  const [agencyDescription, setAgencyDescription] = useState("");
  const [agencyServices, setAgencyServices] = useState("");
  const [agencyResults, setAgencyResults] = useState("");
  const [agencyTargetIndustries, setAgencyTargetIndustries] = useState("");
  const [agencyWebsite, setAgencyWebsite] = useState("");
  const [senderFirstName, setSenderFirstName] = useState("");
  const [senderLastName, setSenderLastName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [savingAgency, setSavingAgency] = useState(false);
  const [generateContext, setGenerateContext] = useState("");
  const [generatingProfile, setGeneratingProfile] = useState(false);

  // Actors
  const [actors, setActors] = useState<ActorDef[]>([]);
  const [showAddActor, setShowAddActor] = useState(false);
  const [newActorId, setNewActorId] = useState("");
  const [newActorName, setNewActorName] = useState("");
  const [newActorPhase, setNewActorPhase] = useState<"find" | "enrich">("find");
  const [savingActor, setSavingActor] = useState(false);
  const [validatingId, setValidatingId] = useState<string | null>(null);

  // Obsidian
  const [vaultEnabled, setVaultEnabled] = useState(false);
  const [savingObsidian, setSavingObsidian] = useState(false);

  // React to OpenRouter OAuth callback flags
  useEffect(() => {
    const success = searchParams?.get("success");
    const errorParam = searchParams?.get("error");
    if (success === "true") {
      toast.success("OpenRouter account connected");
      router.replace("/dashboard/lead-finder/settings");
    } else if (errorParam) {
      toast.error(`OpenRouter sign-in failed: ${errorParam}`);
      router.replace("/dashboard/lead-finder/settings");
    }
  }, [searchParams, router]);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/lead-finder/settings", {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load");
      const d: SettingsData = json.data;
      setData(d);
      setAiProvider(d.ai_provider || "openrouter");
      setAiModel(d.ai_model || "");
      setOllamaBaseUrl(d.ollama_base_url || "");
      setParallelLimit(Number(d.enrichment_concurrency) || 1);
      setAgencyName(d.agency_name || "");
      setAgencyType(d.agency_type || "general");
      setAgencyDescription(d.agency_description || "");
      setAgencyServices(d.agency_services || "");
      setAgencyResults(d.agency_results || "");
      setAgencyTargetIndustries(d.agency_target_industries || "");
      setAgencyWebsite(d.agency_website || "");
      setVaultEnabled(!!d.obsidian_sync_enabled);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadActors = useCallback(async () => {
    try {
      const res = await fetch("/api/lead-finder/actors");
      const json = await res.json();
      if (json?.data) setActors(json.data as ActorDef[]);
    } catch {
      // ignore
    }
  }, []);

  const loadEnvStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/lead-finder/settings/env-status", {
        cache: "no-store",
      });
      const json = await res.json();
      if (res.ok && json?.data) setEnvStatus(json.data);
    } catch {
      // ignore — env status is advisory
    }
  }, []);

  useEffect(() => {
    void loadSettings();
    void loadActors();
    void loadEnvStatus();
  }, [loadSettings, loadActors, loadEnvStatus]);

  async function putSettings(
    payload: Record<string, unknown>,
    setSaving: (v: boolean) => void
  ) {
    setSaving(true);
    try {
      const res = await fetch("/api/lead-finder/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        toast.error(json.error || "Failed to save");
        return;
      }
      toast.success("Saved");
      await loadSettings();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function saveKeys() {
    const isMasked = (v: string) => !v || v.includes("•");
    const payload: Record<string, unknown> = {
      section: "keys",
      ai_provider: aiProvider,
    };
    if (!isMasked(apifyKey)) payload.apify_token = apifyKey.trim();
    if (!isMasked(anthropicKey)) payload.anthropic_api_key = anthropicKey.trim();
    if (!isMasked(openrouterKey))
      payload.openrouter_api_key = openrouterKey.trim();
    if (!isMasked(openaiKey)) payload.openai_api_key = openaiKey.trim();
    if (!isMasked(groqKey)) payload.groq_api_key = groqKey.trim();
    if (ollamaBaseUrl.trim()) payload.ollama_base_url = ollamaBaseUrl.trim();
    if (aiModel.trim()) payload.ai_model = aiModel.trim();
    await putSettings(payload, setSavingKeys);
    setApifyKey("");
    setAnthropicKey("");
    setOpenrouterKey("");
    setOpenaiKey("");
    setGroqKey("");
  }

  async function saveEnrichment() {
    await putSettings(
      {
        section: "enrichment",
        enrichment_concurrency: parallelLimit,
      },
      setSavingEnrichment
    );
  }

  async function saveAgency() {
    await putSettings(
      {
        section: "agency",
        agency_name: agencyName,
        agency_type: agencyType,
        agency_description: agencyDescription,
        agency_services: agencyServices,
        agency_results: agencyResults,
        agency_target_industries: agencyTargetIndustries,
        agency_website: agencyWebsite,
      },
      setSavingAgency
    );
  }

  async function saveObsidian() {
    await putSettings(
      {
        section: "obsidian",
        obsidian_sync_enabled: vaultEnabled,
      },
      setSavingObsidian
    );
  }

  async function generateProfile() {
    const ctx = generateContext.trim();
    if (!ctx) {
      toast.error("Paste website or about-page text first");
      return;
    }
    setGeneratingProfile(true);
    try {
      const res = await fetch("/api/lead-finder/settings/generate-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: ctx }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error || "Generation failed");
        return;
      }
      if (json.agency_name) setAgencyName(String(json.agency_name));
      if (json.agency_description)
        setAgencyDescription(String(json.agency_description));
      if (json.agency_services) setAgencyServices(String(json.agency_services));
      if (json.agency_results) setAgencyResults(String(json.agency_results));
      if (json.agency_target_industries)
        setAgencyTargetIndustries(String(json.agency_target_industries));
      if (json.agency_website) setAgencyWebsite(String(json.agency_website));
      if (json.sender_first_name)
        setSenderFirstName(String(json.sender_first_name));
      if (json.sender_last_name)
        setSenderLastName(String(json.sender_last_name));
      if (json.sender_email) setSenderEmail(String(json.sender_email));
      toast.success("Profile generated — review and save");
    } catch {
      toast.error("Generation failed");
    } finally {
      setGeneratingProfile(false);
    }
  }

  async function addCustomActor() {
    if (!newActorId.trim() || !newActorName.trim()) {
      toast.error("Actor ID and name are required");
      return;
    }
    setSavingActor(true);
    try {
      const res = await fetch("/api/lead-finder/actors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: newActorId.trim(),
          name: newActorName.trim(),
          phase: newActorPhase,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error || "Failed to add actor");
        return;
      }
      toast.success("Actor added");
      setNewActorId("");
      setNewActorName("");
      setNewActorPhase("find");
      setShowAddActor(false);
      await loadActors();
    } catch {
      toast.error("Failed to add actor");
    } finally {
      setSavingActor(false);
    }
  }

  async function deleteCustomActor(actor: ActorDef) {
    if (!actor.dbId) return;
    try {
      const res = await fetch(`/api/lead-finder/actors/${actor.dbId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error || "Failed to delete");
        return;
      }
      toast.success("Actor removed");
      setActors((prev) => prev.filter((a) => a.dbId !== actor.dbId));
    } catch {
      toast.error("Failed to delete actor");
    }
  }

  async function validateActor(actor: ActorDef) {
    setValidatingId(actor.id);
    try {
      const res = await fetch("/api/lead-finder/actors/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: actor.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error || "Validation failed");
        return;
      }
      if (json.valid) {
        toast.success(
          `Actor valid${json.actor?.title ? `: ${json.actor.title}` : ""}`
        );
      } else {
        toast.error(json.error || "Actor not found on Apify");
      }
    } catch {
      toast.error("Validation failed");
    } finally {
      setValidatingId(null);
    }
  }

  const allRequired =
    data?.has_apify && (data?.has_anthropic || data?.has_openrouter);

  const providerTabs = useMemo(
    () => [
      { id: "providers" as const, label: "AI Providers" },
      { id: "agency" as const, label: "Agency Profile" },
      { id: "actors" as const, label: "Actors" },
      { id: "enrichment" as const, label: "Enrichment" },
      { id: "obsidian" as const, label: "Obsidian Sync" },
    ],
    []
  );

  return (
    <Page>
      <PageHeader title="Lead Finder" icon={<MagnifyingGlassIcon size={18} />} />
      <div className="px-8 max-sm:px-4">
        <LeadFinderSubNav />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <CircleNotchIcon size={28} className="animate-spin text-fg-muted" />
        </div>
      )}

      {!loading && data && (
        <>
          <Section className="border-t border-divider py-4">
          <div className="flex items-start gap-3">
            {allRequired ? (
              <CheckCircleIcon
                size={18}
                weight="fill"
                className="text-success flex-shrink-0 mt-0.5"
              />
            ) : (
              <XCircleIcon
                size={18}
                weight="fill"
                className="text-warning flex-shrink-0 mt-0.5"
              />
            )}
            <div>
              <p
                className={`text-sm font-medium ${
                  allRequired
                    ? "text-success"
                    : "text-warning"
                }`}
              >
                {allRequired
                  ? "All required keys configured"
                  : "Missing required API keys"}
              </p>
              <p className="text-xs text-fg-secondary mt-0.5">
                {allRequired
                  ? "Lead Finder is ready to discover and enrich leads."
                  : "Add your Apify token and at least one AI provider key below."}
              </p>
            </div>
          </div>
          </Section>

          {envStatus && (
            <Section title="Environment variables">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { key: "apify", label: "APIFY_TOKEN" },
                  { key: "openrouter", label: "OPENROUTER_API_KEY" },
                  { key: "ollama_cloud", label: "OLLAMA_CLOUD_API_KEY" },
                  { key: "anthropic", label: "ANTHROPIC_API_KEY" },
                  { key: "groq", label: "GROQ_API_KEY" },
                ].map(({ key, label }) => {
                  const configured = !!envStatus[key]?.configured;
                  return (
                    <span
                      key={key}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                        configured
                          ? "border-success bg-success-surface text-success"
                          : "border-line bg-subtle text-fg-secondary"
                      }`}
                    >
                      {configured ? (
                        <CheckCircleIcon size={12} weight="fill" />
                      ) : (
                        <XCircleIcon size={12} weight="fill" />
                      )}
                      {label}
                    </span>
                  );
                })}
              </div>
            </Section>
          )}

          <PageTabs
            tabs={providerTabs}
            value={tab}
            onChange={setTab}
            className="max-sm:overflow-x-auto max-sm:overflow-y-hidden"
          />

          {tab === "providers" && (
            <SectionCard className="border-t-0">
              <SectionHeader
                icon={<LightningIcon size={15} className="text-warning" />}
                title="AI Providers"
                subtitle="Configure keys per provider. Pick a default provider and model."
              />

              <div className="max-w-[560px] space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Default provider">
                    <select
                      value={aiProvider}
                      onChange={(e) => setAiProvider(e.target.value)}
                      className={inputCls}
                    >
                      <option value="anthropic">Anthropic</option>
                      <option value="openai">OpenAI</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="groq">Groq</option>
                      <option value="ollama">Ollama</option>
                      <option value="ollama_cloud">Ollama Cloud</option>
                      <option value="custom">Custom (from AI Assistant settings)</option>
                    </select>
                  </Field>
                  <Field label="Default model">
                    <input
                      type="text"
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      placeholder="e.g. anthropic/claude-sonnet-4"
                      className={inputCls}
                    />
                  </Field>
                </div>

                <ApiKeyField
                  label="Apify Token"
                  value={apifyKey}
                  onChange={setApifyKey}
                  hasValue={data.has_apify}
                  placeholder="apify_api_..."
                  description="Required for running discovery campaigns"
                />
                <ApiKeyField
                  label="Anthropic API Key"
                  value={anthropicKey}
                  onChange={setAnthropicKey}
                  hasValue={data.has_anthropic}
                  placeholder="sk-ant-..."
                  description="console.anthropic.com/settings/keys"
                />
                <div className="space-y-2">
                  <ApiKeyField
                    label="OpenRouter API Key"
                    value={openrouterKey}
                    onChange={setOpenrouterKey}
                    hasValue={data.has_openrouter}
                    placeholder="sk-or-..."
                    description="openrouter.ai/keys — or sign in with OAuth below"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      window.location.href = "/api/lead-finder/auth/openrouter";
                    }}
                  >
                    {data.openrouter_oauth_active
                      ? "Reconnect OpenRouter"
                      : "Sign in with OpenRouter"}
                  </Button>
                </div>
                <ApiKeyField
                  label="OpenAI API Key"
                  value={openaiKey}
                  onChange={setOpenaiKey}
                  hasValue={data.has_openai}
                  placeholder="sk-..."
                  description="platform.openai.com/api-keys"
                />
                <ApiKeyField
                  label="Groq API Key"
                  value={groqKey}
                  onChange={setGroqKey}
                  hasValue={data.has_groq}
                  placeholder="gsk_..."
                  description="console.groq.com/keys"
                />
                <Field label="Ollama base URL">
                  <input
                    type="text"
                    value={ollamaBaseUrl}
                    onChange={(e) => setOllamaBaseUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                    className={inputCls}
                  />
                  <p className="text-xs text-fg-secondary mt-1">
                    Leave blank unless you self-host Ollama.
                  </p>
                </Field>
              </div>
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={saveKeys}
                  disabled={savingKeys}
                  leftIcon={
                    savingKeys ? (
                      <CircleNotchIcon size={14} className="animate-spin" />
                    ) : (
                      <FloppyDiskIcon size={14} />
                    )
                  }
                >
                  Save Providers
                </Button>
              </div>
            </SectionCard>
          )}

          {tab === "agency" && (
            <SectionCard className="border-t-0">
              <div className="flex items-start justify-between mb-4 gap-3">
                <SectionHeader
                  icon={<BuildingsIcon size={15} className="text-accent-strong" />}
                  title="Agency Profile"
                  subtitle="Used for lead scoring, enrichment prompts and outreach personalisation."
                />
              </div>

              <div className="max-w-[560px] space-y-4">
                <Field label="Paste your website/about page text">
                  <textarea
                    rows={4}
                    value={generateContext}
                    onChange={(e) => setGenerateContext(e.target.value)}
                    placeholder="Copy/paste your website hero, about page, or sales deck here..."
                    className={textareaCls}
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateProfile}
                      disabled={generatingProfile}
                      leftIcon={
                        generatingProfile ? (
                          <CircleNotchIcon size={12} className="animate-spin" />
                        ) : (
                          <SparkleIcon size={12} />
                        )
                      }
                    >
                      {generatingProfile ? "Generating..." : "Generate profile"}
                    </Button>
                  </div>
                </Field>

                <Field label="Agency Name">
                  <input
                    type="text"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="Your agency name"
                    className={inputCls}
                  />
                </Field>
                <Field label="Agency Type">
                  <select
                    value={agencyType}
                    onChange={(e) => setAgencyType(e.target.value)}
                    className={inputCls}
                  >
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
                    value={agencyServices}
                    onChange={(e) => setAgencyServices(e.target.value)}
                    placeholder="Key services you offer..."
                    className={textareaCls}
                  />
                </Field>
                <Field label="Results & Case Studies">
                  <textarea
                    rows={2}
                    value={agencyResults}
                    onChange={(e) => setAgencyResults(e.target.value)}
                    placeholder="Case studies, social proof, outcomes..."
                    className={textareaCls}
                  />
                </Field>
                <Field label="Target Industries">
                  <input
                    type="text"
                    value={agencyTargetIndustries}
                    onChange={(e) => setAgencyTargetIndustries(e.target.value)}
                    placeholder="e.g. dental, healthcare, real estate"
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-divider">
                  <Field label="Sender First Name">
                    <input
                      type="text"
                      value={senderFirstName}
                      onChange={(e) => setSenderFirstName(e.target.value)}
                      placeholder="Jane"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Sender Last Name">
                    <input
                      type="text"
                      value={senderLastName}
                      onChange={(e) => setSenderLastName(e.target.value)}
                      placeholder="Doe"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Sender Email">
                    <input
                      type="email"
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      placeholder="jane@agency.com"
                      className={inputCls}
                    />
                  </Field>
                </div>
                <p className="text-xs text-fg-secondary">
                  Sender details are used to prefill outreach. A dedicated
                  persistence API will be enabled in a follow-up migration.
                </p>

              </div>
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={saveAgency}
                  disabled={savingAgency}
                  leftIcon={
                    savingAgency ? (
                      <CircleNotchIcon size={14} className="animate-spin" />
                    ) : (
                      <FloppyDiskIcon size={14} />
                    )
                  }
                >
                  Save Agency Profile
                </Button>
              </div>
            </SectionCard>
          )}

          {tab === "actors" && (
            <>
              <SectionCard className="border-t-0 pb-4">
                <div className="flex items-center justify-between">
                  <SectionHeader
                    icon={<LightningIcon size={15} className="text-warning" />}
                    title="Apify Actors"
                    subtitle="Discovery and enrichment scrapers. Add your own via Apify actor IDs."
                  />
                  <button
                    onClick={() => setShowAddActor((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-accent-strong text-on-inverse hover:bg-accent-strong/90 transition-colors flex-shrink-0"
                  >
                    <PlusIcon size={12} />
                    Add Custom Actor
                  </button>
                </div>

                {showAddActor && (
                  <div className="max-w-[560px] space-y-3">
                    <p className="text-xs font-medium text-fg">
                      New Custom Actor
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <input
                          type="text"
                          value={newActorId}
                          onChange={(e) => setNewActorId(e.target.value)}
                          placeholder="e.g. apify/linkedin-scraper"
                          className={inputCls}
                        />
                        <p className="text-xs text-fg-muted mt-1">
                          Apify actor path
                        </p>
                      </div>
                      <div>
                        <input
                          type="text"
                          value={newActorName}
                          onChange={(e) => setNewActorName(e.target.value)}
                          placeholder="Display name"
                          className={inputCls}
                        />
                        <p className="text-xs text-fg-muted mt-1">
                          Name shown in UI
                        </p>
                      </div>
                      <div>
                        <select
                          value={newActorPhase}
                          onChange={(e) =>
                            setNewActorPhase(e.target.value as "find" | "enrich")
                          }
                          className={inputCls}
                        >
                          <option value="find">Find</option>
                          <option value="enrich">Enrich</option>
                        </select>
                        <p className="text-xs text-fg-muted mt-1">Phase</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={addCustomActor}
                        disabled={savingActor}
                        leftIcon={
                          savingActor ? (
                            <CircleNotchIcon size={13} className="animate-spin" />
                          ) : (
                            <PlusIcon size={13} />
                          )
                        }
                      >
                        Add Actor
                      </Button>
                      <button
                        onClick={() => setShowAddActor(false)}
                        className="px-3 py-1.5 text-xs text-fg-secondary hover:text-fg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </SectionCard>

              <TableSection>
                {actors.length === 0 && (
                  <p className="text-sm text-fg-secondary py-4 text-center">
                    No actors loaded.
                  </p>
                )}
                {actors.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="text-left">Actor</th>
                          <th className="text-left">Phase</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {actors.map((actor) => (
                          <tr key={`${actor.id}:${actor.dbId ?? "builtin"}`}>
                            <td className="py-2">
                              <div className="flex items-center gap-2">
                                <LockIcon
                                  size={16}
                                  className="text-fg-muted flex-shrink-0"
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-fg truncate">
                                    {actor.name}
                                  </p>
                                  <p className="text-xs text-fg-muted truncate">
                                    {actor.id}
                                    {actor.category ? ` · ${actor.category}` : ""}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-2">
                              <span
                                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0 ${
                                  actor.phase === "find"
                                    ? "bg-accent-surface text-accent-on-surface"
                                    : "bg-success-surface text-success"
                                }`}
                              >
                                {actor.phase === "find" ? "Find" : "Enrich"}
                              </span>
                            </td>
                            <td className="py-2">
                              <div className="flex items-center justify-end gap-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => validateActor(actor)}
                                  disabled={validatingId === actor.id}
                                  leftIcon={
                                    validatingId === actor.id ? (
                                      <CircleNotchIcon size={12} className="animate-spin" />
                                    ) : null
                                  }
                                >
                                  Validate
                                </Button>
                                {actor.isCustom && actor.dbId && (
                                  <button
                                    onClick={() => deleteCustomActor(actor)}
                                    className="p-1 text-fg-muted hover:text-danger transition-colors flex-shrink-0"
                                    title="Remove actor"
                                  >
                                    <TrashIcon size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TableSection>
            </>
          )}

          {tab === "enrichment" && (
            <SectionCard className="border-t-0">
              <SectionHeader
                icon={<GearIcon size={15} className="text-accent-strong" />}
                title="Enrichment"
                subtitle="How aggressively leads are enriched across campaigns."
              />
              <div className="max-w-[560px] space-y-4">
                <Field label={`Parallel enrichment limit (${parallelLimit})`}>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    step={1}
                    value={parallelLimit}
                    onChange={(e) => setParallelLimit(Number(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-fg-secondary mt-1">
                    Concurrent enrichment workers. Higher values speed up runs
                    but consume more Apify credits.
                  </p>
                </Field>
              </div>
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={saveEnrichment}
                  disabled={savingEnrichment}
                  leftIcon={
                    savingEnrichment ? (
                      <CircleNotchIcon size={14} className="animate-spin" />
                    ) : (
                      <FloppyDiskIcon size={14} />
                    )
                  }
                >
                  Save Enrichment
                </Button>
              </div>
            </SectionCard>
          )}

          {tab === "obsidian" && (
            <ObsidianSyncSection
              enabled={vaultEnabled}
              setEnabled={setVaultEnabled}
              saving={savingObsidian}
              onSave={saveObsidian}
            />
          )}
        </>
      )}
    </Page>
  );
}

export default function LeadFinderSettingsPage() {
  return (
    <Suspense fallback={null}>
      <LeadFinderSettingsPageInner />
    </Suspense>
  );
}

// ── Obsidian Sync section ───────────────────────────────────────────────────

interface ObsidianFile {
  date: string;
  path?: string;
  size?: number;
  modifiedAt?: string | null;
}

function ObsidianSyncSection({
  enabled,
  setEnabled,
  saving,
  onSave,
}: {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  saving: boolean;
  onSave: () => void;
}) {
  const [files, setFiles] = useState<ObsidianFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewDate, setPreviewDate] = useState<string | null>(null);
  const [previewBody, setPreviewBody] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/lead-finder/obsidian");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }
      setFiles(Array.isArray(json.files) ? (json.files as ObsidianFile[]) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const viewFile = async (date: string) => {
    setPreviewDate(date);
    setPreviewBody(null);
    setPreviewLoading(true);
    try {
      const res = await fetch(
        `/api/lead-finder/obsidian?date=${encodeURIComponent(date)}`
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "Failed to load file");
      }
      const text = await res.text();
      setPreviewBody(text);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load observation file"
      );
      setPreviewDate(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <>
      <SectionCard className="border-t-0">
        <div className="flex items-start justify-between gap-3 mb-4">
          <SectionHeader
            icon={<FloppyDiskIcon size={15} className="text-success" />}
            title="Obsidian Sync"
            subtitle="Daily observation files generated from your campaigns."
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            leftIcon={
              loading ? (
                <CircleNotchIcon size={12} className="animate-spin" />
              ) : null
            }
          >
            Refresh
          </Button>
        </div>

        <div className="max-w-[560px] space-y-4">
          <p className="text-xs text-fg-secondary">Observation files are written to a server-managed vault folder for this organization.</p>
          <label className="flex items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Enable Obsidian sync for this organization
          </label>
          <p className="text-xs text-fg-secondary">Obsidian sync writes files on the server and only works on self-hosted deployments.</p>
        </div>
        <div className="mt-6 flex justify-end">
          <Button
            onClick={onSave}
            disabled={saving}
            leftIcon={
              saving ? (
                <CircleNotchIcon size={14} className="animate-spin" />
              ) : (
                <FloppyDiskIcon size={14} />
              )
            }
          >
            Save Obsidian Settings
          </Button>
        </div>
      </SectionCard>

      <div className="border-t border-divider">
        <TableSection title="Recent observation files">
          {error && (
            <p className="px-8 max-sm:px-4 pb-3 text-xs text-danger">{error}</p>
          )}

          {!error && files.length === 0 && !loading && (
            <p className="text-sm text-fg-secondary py-4 text-center">
              No observation files yet.
            </p>
          )}

          {files.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left">File</th>
                    <th className="text-left">Path</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.date}>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <FileTextIcon size={16} className="shrink-0 text-fg-muted" />
                          <p className="text-sm font-medium text-fg">
                            {file.date}
                          </p>
                        </div>
                      </td>
                      <td className="py-2">
                        {file.path && (
                          <p className="truncate text-xs text-fg-secondary">
                            {file.path}
                          </p>
                        )}
                      </td>
                      <td className="py-2">
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void viewFile(file.date)}
                          >
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TableSection>
      </div>

      {previewDate && (
        <Section
          title={previewDate}
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPreviewDate(null);
                setPreviewBody(null);
              }}
            >
              Close
            </Button>
          }
        >
          <div className="max-h-80 overflow-auto">
            {previewLoading ? (
              <div className="flex items-center gap-2 text-sm text-fg-secondary">
                <CircleNotchIcon size={14} className="animate-spin" />
                Loading...
              </div>
            ) : (
              <pre className="whitespace-pre-wrap text-xs text-fg">
                {previewBody ?? ""}
              </pre>
            )}
          </div>
        </Section>
      )}
    </>
  );
}
