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
} from "@/components/ui";
import { PageHeader } from "@/components/dashboard";
import { cn } from "@/lib/utils";
import { createMarketingAudit, getMarketingAuditById } from "@/lib/actions/marketing";
import { aiRunFullAudit, aiRunQuickSnapshot } from "@/lib/actions/ai-marketing";

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

      const id = (result.data as any).id;
      setAuditId(id);

      // Start polling for progress
      pollRef.current = setInterval(async () => {
        const { data } = await getMarketingAuditById(id);
        if (data) {
          const d = data as any;
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

      // Kick off the AI analysis
      if (auditType === "full") {
        aiRunFullAudit(id);
      } else {
        aiRunQuickSnapshot(id);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <PageHeader title="New Marketing Audit">
        <Button variant="ghost" onClick={() => router.push("/dashboard/marketing")}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" weight="bold" />
          Back
        </Button>
      </PageHeader>

      {isRunning ? (
        /* Running State */
        <div className="flex flex-col items-center justify-center py-20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="mb-6"
          >
            <SparkleIcon className="h-12 w-12 text-indigo-500" weight="fill" />
          </motion.div>
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            Analyzing {businessName || url}
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            {auditType === "full" ? "Running 6-dimension analysis..." : "Quick snapshot in progress..."}
          </p>

          <div className="mt-6 w-full max-w-md">
            <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-indigo-500 rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="mt-2 text-center text-sm text-neutral-400">{progress}%</p>
          </div>

          {auditType === "full" && (
            <div className="mt-6 space-y-1 text-xs text-neutral-400">
              <p className={progress >= 14 ? "text-green-500" : ""}>Content & Messaging {progress >= 14 ? "✓" : "..."}</p>
              <p className={progress >= 28 ? "text-green-500" : ""}>Conversion Optimization {progress >= 28 ? "✓" : "..."}</p>
              <p className={progress >= 42 ? "text-green-500" : ""}>SEO & Discoverability {progress >= 42 ? "✓" : "..."}</p>
              <p className={progress >= 56 ? "text-green-500" : ""}>Competitive Positioning {progress >= 56 ? "✓" : "..."}</p>
              <p className={progress >= 70 ? "text-green-500" : ""}>Brand & Trust {progress >= 70 ? "✓" : "..."}</p>
              <p className={progress >= 85 ? "text-green-500" : ""}>Growth & Strategy {progress >= 85 ? "✓" : "..."}</p>
            </div>
          )}
        </div>
      ) : (
        /* Form */
        <form onSubmit={handleSubmit} className="mx-auto w-full max-w-lg space-y-6">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 space-y-5">
            {/* URL */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                Website URL *
              </label>
              <div className="relative">
                <GlobeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" weight="regular" />
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="example.com"
                  className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 pl-10 pr-4 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                  required
                />
              </div>
            </div>

            {/* Business Name */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                Business Name <span className="text-neutral-400">(optional)</span>
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Acme Inc."
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
              />
            </div>

            {/* Audit Type */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Audit Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                {AUDIT_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setAuditType(type.id)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      auditType === type.id
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500"
                        : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600",
                    )}
                  >
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{type.label}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">{type.description}</p>
                    <p className="mt-1 text-xs text-indigo-500">{type.time}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button type="submit" disabled={isPending} className="w-full">
            <SparkleIcon className="h-4 w-4 mr-2" weight="fill" />
            {isPending ? "Starting..." : "Run Audit"}
          </Button>
        </form>
      )}
    </div>
  );
}
