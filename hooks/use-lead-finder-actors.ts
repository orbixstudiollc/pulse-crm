"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ACTOR_REGISTRY,
  type ActorDefinition,
  type ActorPhase,
  type InputFieldDescription,
} from "@/lib/lead-finder/apify/registry";

interface CustomActorRow {
  id: string;
  actor_id: string;
  name: string;
  phase: "find" | "enrich";
  description: string | null;
  required_input_fields: string[];
  input_field_descriptions: Record<string, InputFieldDescription> | null;
  default_input: Record<string, unknown> | null;
  page_limit_key: string | null;
  is_enabled: boolean;
}

function mapCustomToDefinition(row: CustomActorRow): ActorDefinition {
  return {
    id: row.actor_id,
    name: row.name,
    category: (row.phase === "find" ? "lead-generation" : "enrichment") as ActorDefinition["category"],
    phase: row.phase,
    description: row.description || "",
    requiredInputFields: row.required_input_fields || [],
    inputFieldDescriptions: row.input_field_descriptions || undefined,
    defaultInput: row.default_input || {},
    pageLimitKey: row.page_limit_key || undefined,
  };
}

export function useLeadFinderActors() {
  const [allActors, setAllActors] = useState<ActorDefinition[]>(ACTOR_REGISTRY);

  useEffect(() => {
    fetch("/api/lead-finder/actors")
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json: { data: CustomActorRow[] }) => {
        const custom = (json.data || []).filter((r) => r.is_enabled).map(mapCustomToDefinition);
        if (custom.length > 0) setAllActors([...ACTOR_REGISTRY, ...custom]);
      })
      .catch(() => {});
  }, []);

  const getActorById = useCallback(
    (id: string) => allActors.find((a) => a.id === id),
    [allActors]
  );

  const getActorsByPhase = useCallback(
    (phase: ActorPhase) => allActors.filter((a) => a.phase === phase),
    [allActors]
  );

  return { allActors, getActorById, getActorsByPhase };
}
