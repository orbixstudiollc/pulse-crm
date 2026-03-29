"use client";

import { useEffect, useRef, useCallback } from "react";

export type LeadEventType =
  | "lead:discovered"
  | "lead:kpi-updated"
  | "lead:enrichment-completed"
  | "lead:status-changed"
  | "campaign:discovery-started"
  | "campaign:discovery-completed"
  | "campaign:enrichment-progress";

type EventHandler = (data: Record<string, unknown>) => void;

interface UseLeadEventsOptions {
  campaignId?: string;
  onLeadDiscovered?: EventHandler;
  onLeadKpiUpdated?: EventHandler;
  onLeadEnrichmentCompleted?: EventHandler;
  onLeadStatusChanged?: EventHandler;
  onDiscoveryStarted?: EventHandler;
  onDiscoveryCompleted?: EventHandler;
  onEnrichmentProgress?: EventHandler;
  enabled?: boolean;
}

export function useLeadEvents({
  campaignId,
  onLeadDiscovered,
  onLeadKpiUpdated,
  onLeadEnrichmentCompleted,
  onLeadStatusChanged,
  onDiscoveryStarted,
  onDiscoveryCompleted,
  onEnrichmentProgress,
  enabled = true,
}: UseLeadEventsOptions) {
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriesRef = useRef(0);
  const maxRetries = 5;

  const handlersRef = useRef({
    onLeadDiscovered,
    onLeadKpiUpdated,
    onLeadEnrichmentCompleted,
    onLeadStatusChanged,
    onDiscoveryStarted,
    onDiscoveryCompleted,
    onEnrichmentProgress,
  });

  handlersRef.current = {
    onLeadDiscovered,
    onLeadKpiUpdated,
    onLeadEnrichmentCompleted,
    onLeadStatusChanged,
    onDiscoveryStarted,
    onDiscoveryCompleted,
    onEnrichmentProgress,
  };

  const connect = useCallback(() => {
    if (!enabled) return;

    const url = campaignId
      ? `/api/lead-finder/events?campaignId=${campaignId}`
      : `/api/lead-finder/events`;

    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("lead:discovered", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        handlersRef.current.onLeadDiscovered?.(data);
      } catch {}
    });

    es.addEventListener("lead:kpi-updated", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        handlersRef.current.onLeadKpiUpdated?.(data);
      } catch {}
    });

    es.addEventListener("lead:enrichment-completed", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        handlersRef.current.onLeadEnrichmentCompleted?.(data);
      } catch {}
    });

    es.addEventListener("lead:status-changed", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        handlersRef.current.onLeadStatusChanged?.(data);
      } catch {}
    });

    es.addEventListener("campaign:discovery-started", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        handlersRef.current.onDiscoveryStarted?.(data);
      } catch {}
    });

    es.addEventListener("campaign:discovery-completed", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        handlersRef.current.onDiscoveryCompleted?.(data);
      } catch {}
    });

    es.addEventListener("campaign:enrichment-progress", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        handlersRef.current.onEnrichmentProgress?.(data);
      } catch {}
    });

    es.onopen = () => {
      retriesRef.current = 0;
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      if (retriesRef.current < maxRetries) {
        retriesRef.current++;
        const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30000);
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      }
    };
  }, [campaignId, enabled]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connect]);

  const disconnect = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  return { disconnect };
}
