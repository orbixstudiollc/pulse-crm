"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Badge, FileTextIcon, PaperPlaneTiltIcon } from "@/components/ui";
import {
  Page,
  PageHeader,
  Section,
  DetailLayout,
  PanelSection,
  KeyValueList,
  KeyValue,
} from "@/components/dashboard";
import { usePageHeader } from "@/hooks";
import { markProposalSent } from "@/lib/actions/proposals";
import {
  parsePricingTiers,
  parseProposalSections,
  type PricingTier,
  type ProposalSection,
} from "@/lib/proposals/content";

// ── Types ────────────────────────────────────────────────────────────────────

interface ProposalRecord {
  id: string;
  title: string;
  status: string;
  deal_id: string | null;
  content: unknown;
  pricing_tiers: unknown;
  valid_until: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  created_at: string;
}

// ── Config ───────────────────────────────────────────────────────────────────

const statusConfig: Record<
  string,
  { label: string; variant: "neutral" | "info" | "warning" | "success" | "error" }
> = {
  draft: { label: "Draft", variant: "neutral" },
  sent: { label: "Sent", variant: "info" },
  viewed: { label: "Viewed", variant: "warning" },
  accepted: { label: "Accepted", variant: "success" },
  rejected: { label: "Rejected", variant: "error" },
};

function formatDate(date: string | null): string {
  return date ? new Date(date).toLocaleDateString() : "—";
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function SectionBody({ section }: { section: ProposalSection }) {
  return (
    <>
      {section.text && (
        <p className="whitespace-pre-line text-[14px] leading-6 text-fg-secondary">
          {section.text}
        </p>
      )}
      {section.items && (
        <ul className="list-disc space-y-1 pl-5 text-[14px] leading-6 text-fg-secondary">
          {section.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </>
  );
}

function PricingGrid({ tiers }: { tiers: PricingTier[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {tiers.map((tier, i) => (
        <div key={`${tier.name}-${i}`} className="rounded-lg border border-line bg-surface p-4" data-clay-box>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[14px] font-semibold text-fg">{tier.name}</h3>
            {tier.recommended && <Badge variant="info">Recommended</Badge>}
          </div>
          {tier.price && (
            <p className="mt-1 text-[18px] leading-6 font-semibold text-fg">{tier.price}</p>
          )}
          {tier.features.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] text-fg-secondary">
              {tier.features.map((feature, j) => (
                <li key={j}>{feature}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function ProposalDetailClient({
  proposal,
  dealName,
}: {
  proposal: ProposalRecord;
  dealName: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const status = statusConfig[proposal.status] || statusConfig.draft;
  const sections = parseProposalSections(proposal.content);
  const tiers = parsePricingTiers(proposal.pricing_tiers, proposal.content);
  const hasPricingSection = sections.some((s) => s.key === "pricing_section");

  const headerActions = useMemo(() => {
    if (proposal.status !== "draft") return null;
    const handleMarkSent = () => {
      startTransition(async () => {
        const result = await markProposalSent(proposal.id);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Marked as sent");
          router.refresh();
        }
      });
    };
    return (
      <Button
        leftIcon={<PaperPlaneTiltIcon size={16} />}
        onClick={handleMarkSent}
        loading={isPending}
      >
        Mark as sent
      </Button>
    );
  }, [proposal.id, proposal.status, isPending, router]);

  usePageHeader({
    backHref: "/dashboard/proposals",
    actions: headerActions,
    breadcrumbLabel: proposal.title,
  });

  return (
    <Page>
      <PageHeader
        title={proposal.title}
        icon={<FileTextIcon />}
        description={
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        }
      />

      <DetailLayout
        aside={
          <PanelSection title="Details">
            <KeyValueList>
              <KeyValue label="Status">{status.label}</KeyValue>
              <KeyValue label="Deal">
                {proposal.deal_id ? (
                  <Link
                    href={`/dashboard/sales/${proposal.deal_id}`}
                    className="text-accent-strong hover:underline"
                  >
                    {dealName || "View deal"}
                  </Link>
                ) : (
                  "—"
                )}
              </KeyValue>
              <KeyValue label="Valid until">{formatDate(proposal.valid_until)}</KeyValue>
              <KeyValue label="Created">{formatDate(proposal.created_at)}</KeyValue>
              <KeyValue label="Sent">{formatDate(proposal.sent_at)}</KeyValue>
              <KeyValue label="Viewed">{formatDate(proposal.viewed_at)}</KeyValue>
            </KeyValueList>
          </PanelSection>
        }
      >
        {sections.length === 0 && tiers.length === 0 ? (
          <Section>
            <p className="text-[13px] text-fg-muted">This proposal has no content yet.</p>
          </Section>
        ) : (
          <>
            {sections.map((section) => (
              <Section key={section.key} title={section.title}>
                <SectionBody section={section} />
                {section.key === "pricing_section" && tiers.length > 0 && (
                  <div className="mt-4">
                    <PricingGrid tiers={tiers} />
                  </div>
                )}
              </Section>
            ))}
            {!hasPricingSection && tiers.length > 0 && (
              <Section title="Pricing">
                <PricingGrid tiers={tiers} />
              </Section>
            )}
          </>
        )}
      </DetailLayout>
    </Page>
  );
}
