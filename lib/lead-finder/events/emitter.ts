import { EventEmitter } from "events";

// =============================================================================
// Event payloads (all IDs are UUID strings)
// =============================================================================

export interface LeadDiscoveredEvent {
  leadId: string;
  campaignId: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  status: string;
  rawData: Record<string, unknown> | null;
  mappedData: Record<string, unknown> | null;
  createdAt: string;
  source: string;
  index: number;
  totalItems: number;
}

export interface LeadKpiUpdatedEvent {
  leadId: string;
  campaignId: string;
  kpis: Record<string, boolean | string>;
}

export interface LeadEnrichmentCompletedEvent {
  leadId: string;
  campaignId: string;
  displayName: string | null;
  personalizationSummary: string | null;
  score: number;
  status: string;
}

export interface LeadStatusChangedEvent {
  leadId: string;
  campaignId: string;
  oldStatus: string;
  newStatus: string;
}

export interface CampaignDiscoveryStartedEvent {
  campaignId: string;
  actorIds: string[];
}

export interface CampaignDiscoveryCompletedEvent {
  campaignId: string;
  totalInserted: number;
  totalDeduplicated: number;
}

export interface CampaignEnrichmentProgressEvent {
  campaignId: string;
  completed: number;
  total: number;
  currentLeadId: string | null;
  currentLeadName: string | null;
}

// =============================================================================
// Event map
// =============================================================================

export type LeadEventMap = {
  "lead:discovered": LeadDiscoveredEvent;
  "lead:kpi-updated": LeadKpiUpdatedEvent;
  "lead:enrichment-completed": LeadEnrichmentCompletedEvent;
  "lead:status-changed": LeadStatusChangedEvent;
  "campaign:discovery-started": CampaignDiscoveryStartedEvent;
  "campaign:discovery-completed": CampaignDiscoveryCompletedEvent;
  "campaign:enrichment-progress": CampaignEnrichmentProgressEvent;
};

export type LeadEventType = keyof LeadEventMap;

// =============================================================================
// Singleton emitter (survives HMR via globalThis)
// =============================================================================

class LeadEventEmitter {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  emit<T extends LeadEventType>(event: T, data: LeadEventMap[T]): void {
    this.emitter.emit(event, data);
  }

  on<T extends LeadEventType>(
    event: T,
    handler: (data: LeadEventMap[T]) => void
  ): () => void {
    this.emitter.on(event, handler as (...args: unknown[]) => void);
    return () => {
      this.emitter.off(event, handler as (...args: unknown[]) => void);
    };
  }

  off<T extends LeadEventType>(
    event: T,
    handler: (data: LeadEventMap[T]) => void
  ): void {
    this.emitter.off(event, handler as (...args: unknown[]) => void);
  }
}

const globalForEmitter = globalThis as unknown as {
  lfLeadEmitter?: LeadEventEmitter;
};
export const leadEmitter =
  globalForEmitter.lfLeadEmitter ??= new LeadEventEmitter();
