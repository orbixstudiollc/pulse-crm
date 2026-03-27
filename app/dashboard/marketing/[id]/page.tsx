import { getMarketingAuditById, getMarketingActionItems, getMarketingContent, getMarketingReports } from "@/lib/actions/marketing";
import { AuditDetailClient } from "./client";
import { notFound } from "next/navigation";

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
      audit={auditRes.data as any}
      actionItems={actionsRes.data as any}
      content={contentRes.data as any}
      reports={reportsRes.data as any}
    />
  );
}
