"use client";

import { useEffect, useState } from "react";
import { listTwentyMemories } from "@/lib/actions/twenty-copilot";

export function TwentyMemory({ connectionId }: { connectionId?: string }) {
  const [items, setItems] = useState<Awaited<ReturnType<typeof listTwentyMemories>>>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    listTwentyMemories(connectionId).then((data) => { if (active) setItems(data); })
      .catch(() => { if (active) setError("Could not load Twenty memory. Check your connection and owner/admin access."); });
    return () => { active = false; };
  }, [connectionId]);
  return <div className="space-y-4 overflow-y-auto p-6">
    <h2 className="text-lg font-semibold">Twenty memory</h2>
    <p className="text-sm text-fg-secondary">Ask Copilot to save workspace guidance here. ICPs are read from Twenty.</p>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {!error && !items.length && <p className="text-sm text-fg-muted">No saved Twenty memory yet.</p>}
    {items.map((item) => <article key={item.id} className="rounded-md border border-divider p-4">
      <h3 className="font-medium">{item.title}{!item.is_active ? " (inactive)" : ""}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm">{item.content}</p>
    </article>)}
  </div>;
}
