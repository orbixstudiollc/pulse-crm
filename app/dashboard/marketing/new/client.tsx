"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Button,
  ArrowLeftIcon,
  SparkleIcon,
  GlobeIcon,
  MegaphoneSimpleIcon,
} from "@/components/ui";
import { Page, PageHeader, Section } from "@/components/dashboard";
import { cn } from "@/lib/utils";
import { createMarketingAudit, getMarketingAuditById, updateMarketingAudit } from "@/lib/actions/marketing";
import { aiRunQuickSnapshot, fetchWebsiteContent, aiRunSingleDimension, finalizeFullAudit } from "@/lib/actions/ai-marketing";

// ── Types ────────────────────────────────────────────────────────────────────

const AUDIT_TYPES = [
  { id: "full", label: "Full Audit", description: "6-dimension analysis with scores, findings, and action plan", time: "~2 min" },
  { id: "quick", label: "Quick Snapshot", description: "Fast overview with top issues and wins", time: "~30 sec" },
] as const;

// ── Component ────────────────────────────────────────────────────────────────

export function NewAuditClient() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [url, setUrl] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [auditType, setAuditType] = useState<string>("full");
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [auditId, setAuditId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      toast.error("Please enter a website URL");
      return;
    }

    // Normalize URL
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith("http")) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    setIsRunning(true);
    setProgress(0);

    startTransition(async () => {
      // Create audit record
      const result = await createMarketingAudit({
        website_url: normalizedUrl,
        business_name: businessName.trim() || undefined,
        audit_type: auditType,
      });

      if (result.error || !result.data) {
        toast.error(result.error || "Failed to create audit");
        setIsRunning(false);
        return;
      }

      const id: string = result.data.id;
      setAuditId(id);

      if (auditType === "quick") {
        // Quick snapshot — single server action
        pollRef.current = setInterval(async () => {
          const { data } = await getMarketingAuditById(id);
          if (data) {
            const d = data;
            setProgress(d.progress ?? 0);
            if (d.status === "completed") {
              if (pollRef.current) clearInterval(pollRef.current);
              toast.success(`Audit complete! Score: ${d.overall_score}/100`);
              router.push(`/dashboard/marketing/${id}`);
            } else if (d.status === "failed") {
              if (pollRef.current) clearInterval(pollRef.current);
              toast.error(d.error_message || "Audit failed");
              setIsRunning(false);
            }
          }
        }, 2000);
        aiRunQuickSnapshot(id);
      } else {
        // Full audit — orchestrate dimensions from client (avoids serverless timeout)
        await updateMarketingAudit(id, { status: "running", progress: 0 });

        // Step 1: Fetch website content once
        const websiteContent = await fetchWebsiteContent(normalizedUrl);
        setProgress(5);

        // Step 2: Run each dimension sequentially
        const dimensions = [
          { key: "content", label: "Content & Messaging", prompt: "Evaluate headline clarity, value propositions, CTAs, content quality, persuasion techniques, and overall messaging effectiveness." },
          { key: "conversion", label: "Conversion Optimization", prompt: "Evaluate CTA placement, form design, friction points, social proof, urgency elements, and conversion path clarity." },
          { key: "seo", label: "SEO & Discoverability", prompt: "Evaluate title tags, meta descriptions, heading hierarchy, content depth, keyword targeting, technical SEO signals, and schema markup." },
          { key: "competitive", label: "Competitive Positioning", prompt: "Evaluate differentiation, positioning clarity, unique value proposition, competitive awareness, and market positioning." },
          { key: "brand", label: "Brand & Trust", prompt: "Evaluate visual consistency, trust signals, social proof, authority markers, professional quality, and brand coherence." },
          { key: "growth", label: "Growth & Strategy", prompt: "Evaluate pricing strategy, acquisition channels, retention mechanisms, growth loops, and strategic scalability." },
        ];

        const dimensionResults: Parameters<typeof finalizeFullAudit>[1] = {};

        for (let i = 0; i < dimensions.length; i++) {
          const dim = dimensions[i];
          const dimProgress = Math.round(((i + 1) / dimensions.length) * 90) + 5;

          try {
            const res = await aiRunSingleDimension(
              id, dim.key, dim.label, dim.prompt, websiteContent, normalizedUrl, dimProgress,
            );
            dimensionResults[dim.key] = res.data || { score: 0, findings: [], action_items: [], summary: "Failed" };
          } catch {
            dimensionResults[dim.key] = { score: 0, findings: [], action_items: [], summary: "Failed" };
          }

          setProgress(dimProgress);
        }

        // Step 3: Finalize — calculate weighted score and save
        const finalResult = await finalizeFullAudit(id, dimensionResults);

        if (finalResult.success) {
          toast.success("Full audit complete!");
          router.push(`/dashboard/marketing/${id}`);
        } else {
          toast.error(finalResult.error || "Audit failed");
          setIsRunning(false);
        }
      }
    });
  };

  return (
    <Page>
      <PageHeader title="New Marketing Audit" icon={<MegaphoneSimpleIcon size={18} />}>
        <Button variant="ghost" onClick={() => router.push("/dashboard/marketing")}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" weight="bold" />
          Back
        </Button>
      </PageHeader>

      {isRunning ? (
        /* Running State */
        <div className="flex flex-col items-center justify-center px-8 py-20 max-sm:px-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="mb-6"
          >
            <SparkleIcon className="h-12 w-12 text-accent-strong" weight="fill" />
          </motion.div>
          <h2 className="text-xl font-semibold text-fg">
            Analyzing {businessName || url}
          </h2>
          <p className="mt-2 text-sm text-fg-secondary">
            {auditType === "full" ? "Running 6-dimension analysis..." : "Quick snapshot in progress..."}
          </p>

          <div className="mt-6 w-full max-w-md">
            <div className="h-2 bg-active rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-accent-strong rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="mt-2 text-center text-sm text-fg-secondary">{progress}%</p>
          </div>

          {auditType === "full" && (
            <div className="mt-6 space-y-1 text-xs text-fg-muted">
              <p className={progress >= 14 ? "text-success" : ""}>Content & Messaging {progress >= 14 ? "✓" : "..."}</p>
              <p className={progress >= 28 ? "text-success" : ""}>Conversion Optimization {progress >= 28 ? "✓" : "..."}</p>
              <p className={progress >= 42 ? "text-success" : ""}>SEO & Discoverability {progress >= 42 ? "✓" : "..."}</p>
              <p className={progress >= 56 ? "text-success" : ""}>Competitive Positioning {progress >= 56 ? "✓" : "..."}</p>
              <p className={progress >= 70 ? "text-success" : ""}>Brand & Trust {progress >= 70 ? "✓" : "..."}</p>
              <p className={progress >= 85 ? "text-success" : ""}>Growth & Strategy {progress >= 85 ? "✓" : "..."}</p>
            </div>
          )}
        </div>
      ) : (
        /* Form */
        <form onSubmit={handleSubmit} className="w-full max-w-[560px]">
          <Section className="space-y-5">
            {/* URL */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-fg">
                Website URL <span className="text-danger ml-0.5">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted">
                  <GlobeIcon className="h-4 w-4" weight="regular" />
                </span>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="example.com"
                  className="w-full rounded border border-line bg-surface pl-10 pr-3 py-2.5 text-sm text-fg placeholder:text-fg-muted transition-shadow focus:outline-none focus:border-line focus:shadow-focus"
                  required
                />
              </div>
            </div>

            {/* Business Name */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-fg">
                Business Name
                <span className="text-fg-muted font-normal ml-1">(optional)</span>
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Acme Inc."
                className="w-full rounded border border-line bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted transition-shadow focus:outline-none focus:border-line focus:shadow-focus"
              />
            </div>

            {/* Audit Type */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-fg">
                Audit Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                {AUDIT_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setAuditType(type.id)}
                    data-clay-box className={cn(
                      "rounded border p-3 text-left transition-all",
                      auditType === type.id
                        ? "border-inverse bg-subtle shadow-focus"
                        : "border-line hover:border-fg-muted",
                    )}
                  >
                    <p className="text-sm font-medium text-fg">{type.label}</p>
                    <p className="mt-0.5 text-xs text-fg-secondary">{type.description}</p>
                    <p className="mt-1 text-xs text-fg-muted">{type.time}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isPending}>
                <SparkleIcon className="h-4 w-4 mr-2" weight="fill" />
                {isPending ? "Starting..." : "Run Audit"}
              </Button>
            </div>
          </Section>
        </form>
      )}
    </Page>
  );
}
