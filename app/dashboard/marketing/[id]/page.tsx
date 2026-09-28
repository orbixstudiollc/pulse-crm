import { getMarketingAuditById, getMarketingActionItems, getMarketingContent, getMarketingReports } from "@/lib/actions/marketing";
import { AuditDetailClient } from "./client";
import { notFound } from "next/navigation";
import type { Json } from "@/types/database";

function toRecord(value: Json | null): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}

export default async function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [auditRes, actionsRes, contentRes, reportsRes] = await Promise.all([
    getMarketingAuditById(id),
    getMarketingActionItems(id),
    getMarketingContent({ audit_id: id }),
    getMarketingReports(id),
  ]);

  if (!auditRes.data) return notFound();

  return (
    <AuditDetailClient
      audit={{ ...auditRes.data, progress: auditRes.data.progress ?? 0, result: toRecord(auditRes.data.result) }}
      actionItems={actionsRes.data}
      content={contentRes.data.map((c) => ({ ...c, content: toRecord(c.content) ?? {} }))}
      reports={reportsRes.data}
    />
  );
}
