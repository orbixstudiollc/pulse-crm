// =============================================================================
// Lead Finder – Shared Types
// =============================================================================

export type AIProvider = "openai" | "anthropic" | "openrouter";
export type CampaignStatus = "draft" | "active" | "paused" | "completed";
export type LeadStatus =
  | "new"
  | "enriching"
  | "qualified"
  | "converted"
  | "declined"
  | "archived";
export type ActorPhase = "find" | "enrich";
export type ActorCategory =
  | "lead-generation"
  | "enrichment"
  | "social"
  | "search";

// ---------------------------------------------------------------------------
// Definition helpers (stored as JSONB in campaign rows)
// ---------------------------------------------------------------------------

export interface KpiDefinition {
  id: string;
  label: string;
  type: "boolean" | "text";
  description?: string;
}

export interface LeadFieldDefinition {
  id: string;
  label: string;
  type: "text" | "number" | "boolean" | "url";
  description?: string;
}

export interface InputFieldDescription {
  label: string;
  placeholder: string;
  type: "string" | "string-array" | "number" | "boolean";
  helpText: string;
}

export interface ActorDefinition {
  id: string;
  name: string;
  category: ActorCategory;
  phase: ActorPhase;
  description: string;
  requiredInputFields: string[];
  inputFieldDescriptions?: Record<string, InputFieldDescription>;
  defaultInput?: Record<string, unknown>;
  isCustom?: boolean;
  pageLimitKey?: string;
}

// ---------------------------------------------------------------------------
// DB Row types (matching lf_* tables – UUIDs everywhere)
// ---------------------------------------------------------------------------

export interface LFCampaign {
  id: string;
  organization_id: string;
  created_by: string | null;
  name: string;
  description: string | null;
  target_niche: string;
  apify_actors: string[];
  actor_configs: Record<string, Record<string, unknown>>;
  kpi_definitions: KpiDefinition[];
  lead_field_definitions: LeadFieldDefinition[];
  schedule_frequency: "once" | "daily" | "weekly";
  last_discovery_at: string | null;
  next_discovery_at: string | null;
  ai_provider: AIProvider;
  auto_enrich: boolean;
  max_leads_per_run: number;
  max_pages_per_search: number;
  enrichment_concurrency: number;
  status: CampaignStatus;
  created_at: string;
  updated_at: string;
}

export interface LFLead {
  id: string;
  organization_id: string;
  campaign_id: string | null;
  source: string;
  source_run_id: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  score: number;
  status: LeadStatus;
  raw_data: Record<string, unknown>;
  mapped_data: Record<string, unknown>;
  llm_cost_usd: number;
  llm_input_tokens: number;
  llm_output_tokens: number;
  apify_cost_usd: number;
  discovery_llm_cost_usd: number;
  discovery_apify_cost_usd: number;
  imported: boolean;
  imported_lead_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LFLeadPersonalization {
  id: string;
  lead_id: string;
  website_tech_stack: string[];
  website_quality_score: number | null;
  has_chatbot: boolean;
  has_booking_system: boolean;
  has_automation: boolean;
  recent_news: string | null;
  company_description: string | null;
  key_products: string | null;
  founders_info: string | null;
  last_blog_post: string | null;
  social_media_presence: Record<string, unknown>;
  pain_points: string[];
  personalization_summary: string | null;
  enrichment_actors: string[];
  raw_enrichment_data: Record<string, unknown>;
  campaign_kpis: Record<string, boolean | string>;
  created_at: string;
}

export interface LFApifyRun {
  id: string;
  organization_id: string;
  campaign_id: string | null;
  actor_id: string;
  run_id: string;
  status: "running" | "succeeded" | "failed";
  input_params: Record<string, unknown>;
  result_count: number;
  dataset_id: string | null;
  cost_usd: number | null;
  started_at: string;
  finished_at: string | null;
}

export interface LFLlmCost {
  id: string;
  organization_id: string;
  campaign_id: string | null;
  provider: string;
  model: string;
  operation: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  created_at: string;
}

export interface LFCustomActor {
  id: string;
  organization_id: string;
  actor_id: string;
  name: string;
  phase: ActorPhase;
  description: string | null;
  required_input_fields: string[];
  input_field_descriptions: Record<string, InputFieldDescription> | null;
  default_input: Record<string, unknown> | null;
  page_limit_key: string | null;
  is_enabled: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Insert helpers (for creating new rows)
// ---------------------------------------------------------------------------

export interface NewLFLead {
  organization_id: string;
  campaign_id?: string;
  source: string;
  source_run_id?: string;
  display_name?: string;
  email?: string;
  phone?: string;
  website?: string;
  status?: LeadStatus;
  raw_data?: Record<string, unknown>;
  mapped_data?: Record<string, unknown>;
  llm_cost_usd?: number;
  llm_input_tokens?: number;
  llm_output_tokens?: number;
  discovery_llm_cost_usd?: number;
  discovery_apify_cost_usd?: number;
}

// ---------------------------------------------------------------------------
// AI types
// ---------------------------------------------------------------------------

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIResponse {
  content: string;
  provider: AIProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

// ---------------------------------------------------------------------------
// Actor run / discovery result types
// ---------------------------------------------------------------------------

export interface ActorRunResult {
  actorId: string;
  status: "succeeded" | "failed";
  runId?: string;
  totalResults: number;
  inserted: number;
  deduplicated: number;
  error?: string;
  errorType?: string;
  actionUrl?: string;
  actionLabel?: string;
}

export interface DiscoveryResult {
  results: ActorRunResult[];
  totalInserted: number;
  totalDeduplicated: number;
}

// ---------------------------------------------------------------------------
// Actor workflow descriptor
// ---------------------------------------------------------------------------

export interface ActorWorkflow {
  id: string;
  label: string;
  description: string;
  actors: string[];
}
