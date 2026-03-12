export type AIModel = "haiku" | "sonnet";

export type AIFeature =
  | "lead_scoring"
  | "icp_matching"
  | "outreach"
  | "proposals"
  | "meetings"
  | "analytics"
  | "competitors"
  | "objections"
  | "chat"
  | "lead_validation";

export type AutonomyLevel = "suggest" | "auto_act" | "full_auto";

export interface AISettings {
  id: string;
  organization_id: string;
  api_key: string | null;
  default_model: string;
  // Feature toggles
  feature_lead_scoring: boolean;
  feature_icp_matching: boolean;
  feature_outreach: boolean;
  feature_proposals: boolean;
  feature_meetings: boolean;
  feature_analytics: boolean;
  feature_competitors: boolean;
  feature_objections: boolean;
  feature_chat: boolean;
  // Autonomy levels
  autonomy_lead_scoring: string;
  autonomy_icp_matching: string;
  autonomy_outreach: string;
  autonomy_proposals: string;
  autonomy_meetings: string;
  autonomy_analytics: string;
  autonomy_competitors: string;
  autonomy_objections: string;
  // Integrations
  apify_api_key: string | null;
  // Token usage
  tokens_used_today: number;
  tokens_used_month: number;
  daily_token_limit: number;
  monthly_token_limit: number;
  last_token_reset_daily: string;
  last_token_reset_monthly: string;
  created_at: string;
  updated_at: string;
}

export interface AIResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  tokensUsed?: number;
  model?: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIScoreResult {
  score: number;
  dimensions: {
    fit: number;
    engagement: number;
    intent: number;
    timing: number;
    budget: number;
  };
  reasoning: string;
  recommendations: string[];
}

export interface AIContentResult {
  content: string;
  subject?: string;
  alternatives?: string[];
  metadata?: Record<string, unknown>;
}

export interface PageContext {
  page: string;
  entityType?: "lead" | "deal" | "customer" | "competitor" | "sequence" | "proposal" | "icp" | "contact";
  entityId?: string;
  entityName?: string;
  additionalData?: Record<string, unknown>;
}

export interface AIUsageStats {
  feature: string;
  total_requests: number;
  total_tokens: number;
  avg_tokens: number;
  success_rate: number;
}

export interface AIUsageDailyPoint {
  date: string;
  tokens: number;
  requests: number;
}

export interface AIUsageLogEntry {
  id: string;
  feature: string;
  model: string;
  total_tokens: number;
  duration_ms: number;
  success: boolean;
  error_message: string | null;
  created_at: string;
}
