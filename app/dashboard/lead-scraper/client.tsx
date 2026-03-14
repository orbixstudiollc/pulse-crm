"use client";

import { useState, useTransition, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  MagnifyingGlassIcon,
  XIcon,
  TrashIcon,
  UploadIcon,
  StarIcon,
  UsersIcon,
  SparkleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ExportIcon,
  GlobeIcon,
  CircleNotchIcon,
} from "@/components/ui";
import {
  searchScrapedLeads,
  saveSearch,
  getSavedSearches,
  deleteSavedSearch,
  runSavedSearch,
  importScrapedLeads,
  importCSVToScrapedLeads,
  deleteScrapedLeads,
  getScraperStats,
  verifyScrapedLeadEmails,
  exportScrapedLeads,
} from "@/lib/actions/lead-scraper";
import {
  startApifyScrape,
  checkApifyRunStatus,
  fetchApifyResults,
  getActiveApifyRuns,
  getICPAlignedFilters,
  scoreScrapedLeadsAgainstICP,
} from "@/lib/actions/apify";
import { validateScrapedLeads } from "@/lib/actions/ai-lead-validation";
import { ConfirmModal } from "@/components/dashboard";
import type { Database } from "@/types/database";

type ScrapedLead = Database["public"]["Tables"]["scraped_leads"]["Row"];
type LeadSearch = Database["public"]["Tables"]["lead_searches"]["Row"];
type ApifyRun = Database["public"]["Tables"]["apify_scraper_runs"]["Row"];

type SourceTab = "all" | "google_places" | "instagram" | "linkedin" | "leads_finder";

const SOURCE_TABS: { id: SourceTab; label: string; color: string }[] = [
  { id: "all", label: "All Leads", color: "text-neutral-600 dark:text-neutral-400" },
  { id: "google_places", label: "Google Maps", color: "text-green-600 dark:text-green-400" },
  { id: "instagram", label: "Instagram", color: "text-pink-600 dark:text-pink-400" },
  { id: "linkedin", label: "LinkedIn", color: "text-blue-600 dark:text-blue-400" },
  { id: "leads_finder", label: "Leads Finder", color: "text-indigo-600 dark:text-indigo-400" },
];

const SOURCE_BADGE_STYLES: Record<string, string> = {
  google_places: "border-green-200 dark:border-green-400/30 bg-green-100 text-green-700 dark:bg-green-400/15 dark:text-green-400",
  instagram: "border-pink-200 dark:border-pink-400/30 bg-pink-100 text-pink-700 dark:bg-pink-400/15 dark:text-pink-400",
  linkedin: "border-blue-200 dark:border-blue-400/30 bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-400",
  leads_finder: "border-indigo-200 dark:border-indigo-400/30 bg-indigo-100 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-400",
  csv_upload: "border-neutral-200 dark:border-neutral-700 bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  search: "border-neutral-200 dark:border-neutral-700 bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
};

const SOURCE_LABELS: Record<string, string> = {
  google_places: "Google Maps",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  leads_finder: "Leads Finder",
  csv_upload: "CSV",
  search: "Manual",
};

// ── Count-up hook ───────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return value;
}

// ── CSV Upload Modal ────────────────────────────────────────────────────────

const CSV_FIELDS = [
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "title", label: "Job Title" },
  { key: "company", label: "Company" },
  { key: "industry", label: "Industry" },
  { key: "location", label: "Location" },
  { key: "phone", label: "Phone" },
  { key: "linkedin_url", label: "LinkedIn URL" },
  { key: "company_website", label: "Website" },
  { key: "company_size", label: "Company Size" },
] as const;

function CSVUploadModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<"upload" | "map">("upload");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) { toast.error("CSV must have a header row and at least one data row"); return; }
      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      const rows = lines.slice(1).map((l) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
      setCsvHeaders(headers);
      setCsvRows(rows);
      const autoMap: Record<string, string> = {};
      CSV_FIELDS.forEach((f) => {
        const match = headers.find(
          (h) => h.toLowerCase().replace(/[_ ]/g, "") === f.key.replace(/_/g, "") ||
                 h.toLowerCase().includes(f.label.toLowerCase())
        );
        if (match) autoMap[f.key] = match;
      });
      setMapping(autoMap);
      setStep("map");
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    startTransition(async () => {
      const rows = csvRows.map((row) => {
        const obj: Record<string, string> = {};
        CSV_FIELDS.forEach((f) => {
          const header = mapping[f.key];
          if (header) {
            const idx = csvHeaders.indexOf(header);
            if (idx >= 0 && row[idx]) obj[f.key] = row[idx];
          }
        });
        return obj;
      });
      const res = await importCSVToScrapedLeads(rows);
      if (res.error) { toast.error(res.error); return; }
      toast.success(`Imported ${res.data.length} leads from CSV`);
      onClose();
      onImported();
      setStep("upload"); setCsvHeaders([]); setCsvRows([]); setMapping({});
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60" onClick={onClose} />
      <div className="relative bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
            {step === "upload" ? "Upload CSV" : "Map Columns"}
          </h3>
          <button onClick={onClose} className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50"><XIcon className="w-5 h-5" /></button>
        </div>

        {step === "upload" && (
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            className="border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl p-12 text-center cursor-pointer hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
          >
            <UploadIcon className="w-10 h-10 text-neutral-400 dark:text-neutral-500 mx-auto mb-3" />
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Drag & drop a CSV file here, or click to browse</p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">Supports .csv files with headers</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        )}

        {step === "map" && (
          <div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">Map your CSV columns to lead fields. Found {csvRows.length} rows.</p>
            <div className="space-y-3 mb-6">
              {CSV_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <span className="text-sm text-neutral-700 dark:text-neutral-300 w-32">{field.label}</span>
                  <select value={mapping[field.key] ?? ""} onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className="flex-1 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded text-sm text-neutral-950 dark:text-neutral-50 focus:outline-none">
                    <option value="">— Skip —</option>
                    {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="bg-neutral-100 dark:bg-neutral-800 rounded p-4 mb-4">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Preview (first 3 rows):</p>
              <div className="space-y-2">
                {csvRows.slice(0, 3).map((row, i) => {
                  const mapped = CSV_FIELDS.reduce((acc, f) => {
                    const header = mapping[f.key];
                    if (header) { const idx = csvHeaders.indexOf(header); if (idx >= 0 && row[idx]) acc[f.label] = row[idx]; }
                    return acc;
                  }, {} as Record<string, string>);
                  return <div key={i} className="text-xs text-neutral-700 dark:text-neutral-300">{Object.entries(mapped).map(([k, v]) => `${k}: ${v}`).join(" | ") || "No fields mapped"}</div>;
                })}
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setStep("upload")} className="px-4 py-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50">Back</button>
              <button onClick={handleImport} disabled={isPending || Object.values(mapping).filter(Boolean).length === 0}
                className="px-4 py-2 text-sm bg-neutral-950 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 text-white dark:text-neutral-950 rounded disabled:opacity-50">
                {isPending ? "Importing..." : `Import ${csvRows.length} Rows`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Save Search Modal ───────────────────────────────────────────────────────

function SaveSearchModal({
  open, onClose, filters, resultCount, onSaved,
}: {
  open: boolean; onClose: () => void; filters: Record<string, string>; resultCount: number; onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60" onClick={onClose} />
      <div className="relative bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50 mb-4">Save Search</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Search name..."
          className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded text-sm text-neutral-950 dark:text-neutral-50 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 mb-4" />
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50">Cancel</button>
          <button onClick={() => { if (!name.trim()) return; startTransition(async () => { await saveSearch(name.trim(), filters, resultCount); toast.success("Search saved"); setName(""); onClose(); onSaved(); }); }} disabled={isPending}
            className="px-4 py-2 text-sm bg-neutral-950 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 text-white dark:text-neutral-950 rounded disabled:opacity-50">
            {isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Source-specific Filter Panels ────────────────────────────────────────────

const inputClass = "w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded text-sm text-neutral-950 dark:text-neutral-50 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600";

function GoogleMapsPanel({
  onScrape, isPending, icpLoading, onAlignICP,
}: {
  onScrape: (input: Record<string, unknown>) => void; isPending: boolean; icpLoading: boolean; onAlignICP: () => Promise<Record<string, string> | null>;
}) {
  const [searchTerms, setSearchTerms] = useState("");
  const [location, setLocation] = useState("");
  const [maxResults, setMaxResults] = useState("20");
  const [icpAligned, setIcpAligned] = useState(false);

  const handleAlignICP = async () => {
    const filters = await onAlignICP();
    if (filters) {
      if (filters.industry) setSearchTerms((prev) => prev || filters.industry);
      if (filters.location) setLocation((prev) => prev || filters.location);
      setIcpAligned(true);
      toast.success("ICP filters applied");
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Search Terms</label>
        <input value={searchTerms} onChange={(e) => setSearchTerms(e.target.value)} placeholder="e.g. SaaS companies, restaurants" className={inputClass} />
      </div>
      <div>
        <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Location</label>
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. New York, USA" className={inputClass} />
      </div>
      <div>
        <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Max Results</label>
        <input value={maxResults} onChange={(e) => setMaxResults(e.target.value)} type="number" placeholder="20" className={inputClass} />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={handleAlignICP} disabled={icpLoading} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-neutral-200 dark:border-neutral-800 rounded text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50">
          {icpLoading ? <CircleNotchIcon className="w-3 h-3 animate-spin" /> : <SparkleIcon className="w-3 h-3" />} Align with ICP
        </button>
        {icpAligned && <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-400/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-400/30">ICP Aligned</span>}
      </div>
      <button onClick={() => onScrape({ searchTerms, location, maxResults: parseInt(maxResults) || 20 })} disabled={isPending || !searchTerms}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-neutral-950 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-sm font-medium rounded disabled:opacity-50">
        {isPending ? <><CircleNotchIcon className="w-4 h-4 animate-spin" /> Starting...</> : <><GlobeIcon className="w-4 h-4" /> Start Scrape</>}
      </button>
    </div>
  );
}

function InstagramPanel({
  onScrape, isPending,
}: {
  onScrape: (input: Record<string, unknown>) => void; isPending: boolean;
}) {
  const [mode, setMode] = useState<"usernames" | "search">("usernames");
  const [usernames, setUsernames] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("user");
  const [resultsLimit, setResultsLimit] = useState("20");

  const canStart = mode === "usernames" ? usernames.trim() : searchQuery.trim();

  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
        <button onClick={() => setMode("usernames")} className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${mode === "usernames" ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm" : "text-neutral-500 dark:text-neutral-400"}`}>
          By Username
        </button>
        <button onClick={() => setMode("search")} className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${mode === "search" ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm" : "text-neutral-500 dark:text-neutral-400"}`}>
          Search
        </button>
      </div>
      {mode === "usernames" ? (
        <div>
          <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Usernames or URLs (one per line)</label>
          <textarea value={usernames} onChange={(e) => setUsernames(e.target.value)} placeholder={"@username1\nhttps://instagram.com/username2"} rows={4}
            className={inputClass + " resize-none"} />
        </div>
      ) : (
        <>
          <div>
            <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Search Query</label>
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="e.g. fitness coach, bakery" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Search Type</label>
            <select value={searchType} onChange={(e) => setSearchType(e.target.value)} className={inputClass}>
              <option value="user">Users / Profiles</option>
              <option value="hashtag">Hashtags</option>
              <option value="place">Places</option>
            </select>
          </div>
        </>
      )}
      <div>
        <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Results Limit</label>
        <input value={resultsLimit} onChange={(e) => setResultsLimit(e.target.value)} type="number" placeholder="20" className={inputClass} />
      </div>
      <button onClick={() => {
        if (mode === "usernames") {
          onScrape({ usernames: usernames.split("\n").map((u) => u.trim()).filter(Boolean), resultsLimit: parseInt(resultsLimit) || 20 });
        } else {
          onScrape({ search: searchQuery.trim(), searchType, resultsLimit: parseInt(resultsLimit) || 20 });
        }
      }}
        disabled={isPending || !canStart}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-neutral-950 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-sm font-medium rounded disabled:opacity-50">
        {isPending ? <><CircleNotchIcon className="w-4 h-4 animate-spin" /> Starting...</> : <><GlobeIcon className="w-4 h-4" /> Start Scrape</>}
      </button>
    </div>
  );
}

function LinkedInPanel({
  onScrape, isPending,
}: {
  onScrape: (input: Record<string, unknown>) => void; isPending: boolean;
}) {
  const [profileUrls, setProfileUrls] = useState("");
  const [mode, setMode] = useState("short");
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Profile URLs (one per line)</label>
        <textarea value={profileUrls} onChange={(e) => setProfileUrls(e.target.value)} placeholder={"https://linkedin.com/in/user1\nhttps://linkedin.com/in/user2"} rows={4}
          className={inputClass + " resize-none"} />
      </div>
      <div>
        <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Mode</label>
        <select value={mode} onChange={(e) => setMode(e.target.value)}
          className={inputClass}>
          <option value="short">Short (Basic Info)</option>
          <option value="full">Full (All Details)</option>
        </select>
      </div>
      <button onClick={() => onScrape({ profileUrls: profileUrls.split("\n").map((u) => u.trim()).filter(Boolean), mode })}
        disabled={isPending || !profileUrls.trim()}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-neutral-950 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-sm font-medium rounded disabled:opacity-50">
        {isPending ? <><CircleNotchIcon className="w-4 h-4 animate-spin" /> Starting...</> : <><GlobeIcon className="w-4 h-4" /> Start Scrape</>}
      </button>
    </div>
  );
}

function LeadsFinderPanel({
  onScrape, isPending, icpLoading, onAlignICP,
}: {
  onScrape: (input: Record<string, unknown>) => void; isPending: boolean; icpLoading: boolean; onAlignICP: () => Promise<Record<string, string> | null>;
}) {
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");
  const [industry, setIndustry] = useState("");
  const [numLeads, setNumLeads] = useState("25");
  const [icpAligned, setIcpAligned] = useState(false);

  const handleAlignICP = async () => {
    const filters = await onAlignICP();
    if (filters) {
      if (filters.title) setJobTitle((prev) => prev || filters.title);
      if (filters.location) setLocation((prev) => prev || filters.location);
      if (filters.industry) setIndustry((prev) => prev || filters.industry);
      setIcpAligned(true);
      toast.success("ICP filters applied");
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Job Title</label>
        <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. VP Sales, CTO" className={inputClass} />
      </div>
      <div>
        <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Location</label>
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. San Francisco, US" className={inputClass} />
      </div>
      <div>
        <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Industry</label>
        <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. SaaS, FinTech" className={inputClass} />
      </div>
      <div>
        <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Number of Leads</label>
        <input value={numLeads} onChange={(e) => setNumLeads(e.target.value)} type="number" placeholder="25" className={inputClass} />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={handleAlignICP} disabled={icpLoading} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-neutral-200 dark:border-neutral-800 rounded text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50">
          {icpLoading ? <CircleNotchIcon className="w-3 h-3 animate-spin" /> : <SparkleIcon className="w-3 h-3" />} Align with ICP
        </button>
        {icpAligned && <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-400/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-400/30">ICP Aligned</span>}
      </div>
      <button onClick={() => onScrape({ jobTitle, location, industry, numLeads: parseInt(numLeads) || 25 })} disabled={isPending || !jobTitle}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-neutral-950 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-sm font-medium rounded disabled:opacity-50">
        {isPending ? <><CircleNotchIcon className="w-4 h-4 animate-spin" /> Starting...</> : <><GlobeIcon className="w-4 h-4" /> Start Scrape</>}
      </button>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

interface LeadScraperPageProps {
  initialStats: { totalLeads: number; verified: number; imported: number; savedSearches: number };
  initialSearches: LeadSearch[];
  initialLeads: ScrapedLead[];
  initialCount: number;
  initialActiveRuns?: ApifyRun[];
}

export function LeadScraperPageClient({
  initialStats,
  initialSearches,
  initialLeads,
  initialCount,
  initialActiveRuns,
}: LeadScraperPageProps) {
  const [isPending, startTransition] = useTransition();

  // Data
  const [stats, setStats] = useState(initialStats);
  const [searches, setSearches] = useState(initialSearches);
  const [leads, setLeads] = useState(initialLeads);
  const [totalCount, setTotalCount] = useState(initialCount);
  const [activeRuns, setActiveRuns] = useState<ApifyRun[]>(initialActiveRuns ?? []);

  // Source tab
  const [activeTab, setActiveTab] = useState<SourceTab>("all");

  // Filters (for "all" tab)
  const [filterTitle, setFilterTitle] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterIndustry, setFilterIndustry] = useState("");
  const [filterSource, setFilterSource] = useState("");

  // UI
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(25);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [showSaveSearch, setShowSaveSearch] = useState(false);
  const [icpLoading, setIcpLoading] = useState(false);
  const [scrapeStarting, setScrapeStarting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Animated stats
  const animTotal = useCountUp(stats.totalLeads);
  const animVerified = useCountUp(stats.verified);
  const animImported = useCountUp(stats.imported);
  const animSearches = useCountUp(stats.savedSearches);

  const currentFilters = { title: filterTitle, company: filterCompany, location: filterLocation, industry: filterIndustry };

  // ── Polling for active runs ───────────────────────────────────────────────
  useEffect(() => {
    if (activeRuns.length === 0) return;
    const interval = setInterval(async () => {
      const { data: runs } = await getActiveApifyRuns();
      if (!runs || runs.length === 0) {
        setActiveRuns([]);
        clearInterval(interval);
        // Refresh data
        refresh();
        toast.success("Scrape completed! Results loaded.");
        return;
      }
      // Check each run
      for (const run of activeRuns) {
        if (run.status === "pending" || run.status === "running") {
          const { data: updated } = await checkApifyRunStatus(run.id);
          if (updated?.status === "succeeded") {
            await fetchApifyResults(run.id);
          }
        }
      }
      setActiveRuns(runs);
    }, 5000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRuns.length]);

  const refresh = useCallback(() => {
    startTransition(async () => {
      const sourceFilter = activeTab !== "all" ? activeTab : (filterSource || undefined);
      const [s, sr, l] = await Promise.all([
        getScraperStats(),
        getSavedSearches(),
        searchScrapedLeads(
          {
            title: filterTitle || undefined,
            company: filterCompany || undefined,
            location: filterLocation || undefined,
            industry: filterIndustry || undefined,
            source: sourceFilter,
          },
          { offset: page * perPage, limit: perPage }
        ),
      ]);
      setStats(s.data);
      setSearches(sr.data);
      setLeads(l.data);
      setTotalCount(l.count);
    });
  }, [filterTitle, filterCompany, filterLocation, filterIndustry, filterSource, activeTab, page, perPage]);

  const handleSearch = () => { setPage(0); setSelectedRows(new Set()); refresh(); };

  const handleTabChange = (tab: SourceTab) => {
    setActiveTab(tab);
    setPage(0);
    setSelectedRows(new Set());
    // Refresh with new source filter
    startTransition(async () => {
      const sourceFilter = tab !== "all" ? tab : undefined;
      const l = await searchScrapedLeads({ source: sourceFilter }, { offset: 0, limit: perPage });
      setLeads(l.data);
      setTotalCount(l.count);
    });
  };

  // ── Scraper actions ───────────────────────────────────────────────────────

  const handleStartScrape = async (source: SourceTab, input: Record<string, unknown>) => {
    if (source === "all") return;
    setScrapeStarting(true);
    try {
      const result = await startApifyScrape({ source, input });
      if (result.error) { toast.error(result.error); return; }
      toast.success("Scrape started! Results will appear when ready.");
      // Add to active runs
      const { data: runs } = await getActiveApifyRuns();
      if (runs) setActiveRuns(runs);
    } catch {
      toast.error("Failed to start scrape");
    } finally {
      setScrapeStarting(false);
    }
  };

  const handleAlignICP = async (): Promise<Record<string, string> | null> => {
    setIcpLoading(true);
    try {
      const result = await getICPAlignedFilters();
      if (result.error || !result.data) { toast.error(result.error || "No ICP profile found"); return null; }
      // Flatten ICP data to simple key-value for filter panels
      const d = result.data;
      return {
        industry: d.industries?.[0] || "",
        location: d.geographies?.[0] || "",
        title: "", // ICP doesn't specify title
        companySize: d.companySizes?.[0] || "",
      };
    } catch {
      toast.error("Failed to load ICP filters");
      return null;
    } finally {
      setIcpLoading(false);
    }
  };

  // ── Bulk actions ──────────────────────────────────────────────────────────

  const handleImportSelected = () => {
    if (selectedRows.size === 0) return;
    startTransition(async () => {
      const res = await importScrapedLeads(Array.from(selectedRows));
      if (res.error) { toast.error(res.error); return; }
      toast.success(`Imported ${res.imported} leads to CRM`);
      setSelectedRows(new Set()); refresh();
    });
  };

  const handleDeleteSelected = () => {
    if (selectedRows.size === 0) return;
    setConfirmDelete(true);
  };

  const executeDelete = () => {
    setConfirmDelete(false);
    startTransition(async () => {
      await deleteScrapedLeads(Array.from(selectedRows));
      toast.success("Leads deleted");
      setSelectedRows(new Set()); refresh();
    });
  };

  const handleVerifySelected = () => {
    if (selectedRows.size === 0) return;
    startTransition(async () => {
      await verifyScrapedLeadEmails(Array.from(selectedRows));
      toast.success("Emails verified");
      setSelectedRows(new Set()); refresh();
    });
  };

  const handleScoreICP = () => {
    if (selectedRows.size === 0) return;
    startTransition(async () => {
      const res = await scoreScrapedLeadsAgainstICP(Array.from(selectedRows));
      if (res.error) { toast.error(res.error); return; }
      toast.success(`Scored ${res.data?.scored ?? 0} leads against ICP`);
      setSelectedRows(new Set()); refresh();
    });
  };

  const handleAIValidate = () => {
    if (selectedRows.size === 0) return;
    startTransition(async () => {
      const res = await validateScrapedLeads(Array.from(selectedRows));
      if (res.error) { toast.error(res.error); return; }
      toast.success(`Validated ${res.data?.validated ?? 0} leads, enriched ${res.data?.enriched ?? 0}`);
      setSelectedRows(new Set()); refresh();
    });
  };

  const handleExport = () => {
    startTransition(async () => {
      const res = await exportScrapedLeads();
      if (res.error) { toast.error(res.error); return; }
      const headers = ["First Name", "Last Name", "Email", "Title", "Company", "Industry", "Location", "LinkedIn", "Website", "Company Size", "Phone", "Verified", "Imported"];
      const rows = res.data.map((l: Record<string, unknown>) => [
        l.first_name, l.last_name, l.email, l.title, l.company, l.industry, l.location,
        l.linkedin_url, l.company_website, l.company_size, l.phone, l.verified, l.imported,
      ].map((v) => `"${v ?? ""}"`).join(","));
      const csv = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scraped-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    });
  };

  const handleLoadSearch = (search: LeadSearch) => {
    const f = search.filters as Record<string, string>;
    setFilterTitle(f.title ?? ""); setFilterCompany(f.company ?? ""); setFilterLocation(f.location ?? ""); setFilterIndustry(f.industry ?? "");
    setActiveTab("all"); setPage(0);
    startTransition(async () => {
      await runSavedSearch(search.id);
      const l = await searchScrapedLeads({ title: f.title, company: f.company, location: f.location, industry: f.industry }, { offset: 0, limit: perPage });
      setLeads(l.data); setTotalCount(l.count);
    });
  };

  const handleDeleteSearch = (id: string) => {
    startTransition(async () => {
      await deleteSavedSearch(id);
      toast.success("Search deleted");
      const sr = await getSavedSearches();
      setSearches(sr.data);
    });
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === leads.length) setSelectedRows(new Set());
    else setSelectedRows(new Set(leads.map((l) => l.id)));
  };

  const toggleSelect = (id: string) => {
    setSelectedRows((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const totalPages = Math.ceil(totalCount / perPage);

  const kpis = [
    { label: "Total Leads Found", value: animTotal, icon: UsersIcon },
    { label: "Verified", value: animVerified, icon: CheckCircleIcon },
    { label: "Imported to CRM", value: animImported, icon: ArrowRightIcon },
    { label: "Saved Searches", value: animSearches, icon: StarIcon },
  ];

  const isScraperTab = activeTab !== "all";

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] leading-[36px] tracking-[-0.56px] font-serif text-neutral-950 dark:text-neutral-50">Lead Finder</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Search, scrape, and import leads into your CRM</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 border border-neutral-200 dark:border-neutral-800 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <ExportIcon className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => setShowCSVUpload(true)} className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 border border-neutral-200 dark:border-neutral-800 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <UploadIcon className="w-4 h-4" /> Upload CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
            <div className="flex items-start justify-between p-5">
              <div className="space-y-2">
                <p className="text-xs font-normal uppercase leading-5 text-neutral-500 dark:text-neutral-400">{kpi.label}</p>
                <p className="text-[32px] leading-[40px] tracking-[-0.64px] font-serif text-neutral-950 dark:text-neutral-50">{kpi.value.toLocaleString()}</p>
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-800">
                <kpi.icon className="w-6 h-6 text-neutral-950 dark:text-neutral-50" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Source Tabs */}
      <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-900 p-1 rounded w-fit">
        {SOURCE_TABS.map((tab) => (
          <button key={tab.id} onClick={() => handleTabChange(tab.id)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id
                ? "bg-white dark:bg-neutral-800 text-neutral-950 dark:text-neutral-50 shadow-sm"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Runs Status Bar */}
      {activeRuns.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-400/10 border border-blue-200 dark:border-blue-400/20 rounded">
          <CircleNotchIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
          <span className="text-sm text-blue-700 dark:text-blue-300">
            {activeRuns.length} scrape{activeRuns.length > 1 ? "s" : ""} running...
            {activeRuns.map((r) => (
              <span key={r.id} className="ml-2 text-xs text-blue-500 dark:text-blue-400">
                [{SOURCE_LABELS[r.source] || r.source}]
              </span>
            ))}
          </span>
        </div>
      )}

      {/* Two Panel Layout */}
      <div className="flex gap-6">
        {/* Left: Search & Filters */}
        <div className="w-80 shrink-0">
          <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 sticky top-6">
            {isScraperTab ? (
              <>
                <h3 className="text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-4">
                  {SOURCE_TABS.find((t) => t.id === activeTab)?.label} Scraper
                </h3>
                {activeTab === "google_places" && (
                  <GoogleMapsPanel onScrape={(input) => handleStartScrape("google_places", input)} isPending={scrapeStarting} icpLoading={icpLoading} onAlignICP={handleAlignICP} />
                )}
                {activeTab === "instagram" && (
                  <InstagramPanel onScrape={(input) => handleStartScrape("instagram", input)} isPending={scrapeStarting} />
                )}
                {activeTab === "linkedin" && (
                  <LinkedInPanel onScrape={(input) => handleStartScrape("linkedin", input)} isPending={scrapeStarting} />
                )}
                {activeTab === "leads_finder" && (
                  <LeadsFinderPanel onScrape={(input) => handleStartScrape("leads_finder", input)} isPending={scrapeStarting} icpLoading={icpLoading} onAlignICP={handleAlignICP} />
                )}
              </>
            ) : (
              <>
                <h3 className="text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-4">Search Filters</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Job Title / Keywords</label>
                    <input value={filterTitle} onChange={(e) => setFilterTitle(e.target.value)} placeholder="e.g. VP Sales, CTO" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Company</label>
                    <input value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} placeholder="e.g. Acme Corp" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Location</label>
                    <input value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} placeholder="e.g. San Francisco, US" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Industry</label>
                    <input value={filterIndustry} onChange={(e) => setFilterIndustry(e.target.value)} placeholder="e.g. SaaS, FinTech" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Source</label>
                    <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className={inputClass}>
                      <option value="">All Sources</option>
                      <option value="google_places">Google Maps</option>
                      <option value="instagram">Instagram</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="leads_finder">Leads Finder</option>
                      <option value="csv_upload">CSV Upload</option>
                      <option value="search">Manual</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleSearch} disabled={isPending}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-neutral-950 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-sm font-medium rounded disabled:opacity-50">
                      <MagnifyingGlassIcon className="w-4 h-4" /> Search
                    </button>
                    <button onClick={() => setShowSaveSearch(true)}
                      className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 border border-neutral-200 dark:border-neutral-800 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
                      <StarIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Saved Searches */}
                {searches.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                    <h4 className="text-xs text-neutral-500 dark:text-neutral-400 font-medium mb-3">Saved Searches</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {searches.map((s) => (
                        <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-neutral-100 dark:bg-neutral-800 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer transition-colors"
                          onClick={() => handleLoadSearch(s)}>
                          <div>
                            <span className="text-sm text-neutral-950 dark:text-neutral-50 block">{s.name}</span>
                            <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{s.result_count} results</span>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteSearch(s.id); }}
                            className="text-neutral-400 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400"><TrashIcon className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right: Results */}
        <div className="flex-1 min-w-0">
          {/* Results header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-neutral-500 dark:text-neutral-400">{totalCount.toLocaleString()} leads found</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400 dark:text-neutral-500">Per page:</span>
              {[25, 50, 100].map((n) => (
                <button key={n} onClick={() => { setPerPage(n); setPage(0); refresh(); }}
                  className={`px-2 py-0.5 text-xs rounded ${perPage === n ? "bg-neutral-950 dark:bg-white text-white dark:text-neutral-950" : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50"}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Results table */}
          <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
            {/* Bulk Actions Bar */}
            {selectedRows.size > 0 && (
              <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
                <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {selectedRows.size} item{selectedRows.size !== 1 ? "s" : ""} selected
                </span>
                <div className="flex items-center gap-4">
                  <button onClick={handleImportSelected} disabled={isPending}
                    className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors disabled:opacity-50">
                    Import to CRM
                  </button>
                  <button onClick={handleVerifySelected} disabled={isPending}
                    className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors disabled:opacity-50">
                    Verify
                  </button>
                  <button onClick={handleScoreICP} disabled={isPending}
                    className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors disabled:opacity-50">
                    Score ICP
                  </button>
                  <button onClick={handleAIValidate} disabled={isPending}
                    className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors disabled:opacity-50">
                    AI Validate
                  </button>
                  <button onClick={handleDeleteSelected} disabled={isPending}
                    className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors disabled:opacity-50">
                    Delete
                  </button>
                  <button onClick={() => setSelectedRows(new Set())}
                    className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors">
                    Clear selection
                  </button>
                </div>
              </div>
            )}
            {leads.length === 0 ? (
              <div className="p-12 text-center">
                <MagnifyingGlassIcon className="w-10 h-10 text-neutral-400 dark:text-neutral-500 mx-auto mb-3" />
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">No leads found</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500">Upload a CSV, run a scraper, or adjust your filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800">
                      <th className="w-10 px-4 py-3">
                        <input type="checkbox" checked={selectedRows.size === leads.length && leads.length > 0} onChange={toggleSelectAll}
                          className="rounded border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-950 dark:text-neutral-50" />
                      </th>
                      <th className="text-left text-xs text-neutral-400 dark:text-neutral-500 font-medium px-4 py-3">Name</th>
                      <th className="text-left text-xs text-neutral-400 dark:text-neutral-500 font-medium px-4 py-3">Title</th>
                      <th className="text-left text-xs text-neutral-400 dark:text-neutral-500 font-medium px-4 py-3">Company</th>
                      <th className="text-left text-xs text-neutral-400 dark:text-neutral-500 font-medium px-4 py-3">Location</th>
                      <th className="text-left text-xs text-neutral-400 dark:text-neutral-500 font-medium px-4 py-3">Email</th>
                      <th className="text-center text-xs text-neutral-400 dark:text-neutral-500 font-medium px-3 py-3">Source</th>
                      <th className="text-center text-xs text-neutral-400 dark:text-neutral-500 font-medium px-3 py-3">ICP</th>
                      <th className="text-center text-xs text-neutral-400 dark:text-neutral-500 font-medium px-3 py-3">Quality</th>
                      <th className="text-center text-xs text-neutral-400 dark:text-neutral-500 font-medium px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr key={lead.id} className="border-b border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selectedRows.has(lead.id)} onChange={() => toggleSelect(lead.id)}
                            className="rounded border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-950 dark:text-neutral-50" />
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-neutral-950 dark:text-neutral-50">{[lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—"}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400 max-w-[140px] truncate">{lead.title || "—"}</td>
                        <td className="px-4 py-3">
                          <div>
                            <span className="text-sm text-neutral-700 dark:text-neutral-300">{lead.company || "—"}</span>
                            {lead.company_size && <span className="text-[10px] text-neutral-400 dark:text-neutral-500 ml-1">({lead.company_size})</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400 max-w-[120px] truncate">{lead.location || "—"}</td>
                        <td className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400 max-w-[160px] truncate">{lead.email || "—"}</td>
                        <td className="px-3 py-3 text-center">
                          {lead.source ? (
                            <span className={`inline-block px-1.5 py-0.5 border-[0.5px] rounded text-[10px] whitespace-nowrap ${SOURCE_BADGE_STYLES[lead.source] || SOURCE_BADGE_STYLES.search}`}>
                              {SOURCE_LABELS[lead.source] || lead.source}
                            </span>
                          ) : <span className="text-xs text-neutral-400 dark:text-neutral-500">—</span>}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <ScoreBadge score={lead.icp_match_score} />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <ScoreBadge score={lead.ai_quality_score} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {lead.verified && (
                              <span className="px-1.5 py-0.5 border-[0.5px] border-green-200 dark:border-green-400/30 bg-green-100 text-green-600 dark:bg-green-400/15 dark:text-green-400 rounded text-[10px]">Verified</span>
                            )}
                            {lead.imported && (
                              <span className="px-1.5 py-0.5 border-[0.5px] border-indigo-200 dark:border-indigo-400/30 bg-indigo-100 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-400 rounded text-[10px]">Imported</span>
                            )}
                            {!lead.verified && !lead.imported && (
                              <span className="text-xs text-neutral-400 dark:text-neutral-500">New</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 dark:border-neutral-800">
                <span className="text-xs text-neutral-400 dark:text-neutral-500">Page {page + 1} of {totalPages}</span>
                <div className="flex gap-2">
                  <button onClick={() => { setPage(Math.max(0, page - 1)); refresh(); }} disabled={page === 0}
                    className="px-3 py-1 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 border border-neutral-200 dark:border-neutral-800 rounded disabled:opacity-30">Previous</button>
                  <button onClick={() => { setPage(Math.min(totalPages - 1, page + 1)); refresh(); }} disabled={page >= totalPages - 1}
                    className="px-3 py-1 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 border border-neutral-200 dark:border-neutral-800 rounded disabled:opacity-30">Next</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <CSVUploadModal open={showCSVUpload} onClose={() => setShowCSVUpload(false)} onImported={refresh} />
      <SaveSearchModal open={showSaveSearch} onClose={() => setShowSaveSearch(false)} filters={currentFilters} resultCount={totalCount} onSaved={refresh} />
      <ConfirmModal
        open={confirmDelete}
        title="Delete Leads"
        message={`Delete ${selectedRows.size} lead${selectedRows.size !== 1 ? "s" : ""}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={executeDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

// ── Score Badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-xs text-neutral-400 dark:text-neutral-500">—</span>;
  let style = "border-neutral-200 dark:border-neutral-700 bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400";
  if (score >= 75) style = "border-green-200 dark:border-green-400/30 bg-green-100 text-green-700 dark:bg-green-400/15 dark:text-green-400";
  else if (score >= 50) style = "border-amber-200 dark:border-amber-400/30 bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-400";
  else if (score > 0) style = "border-red-200 dark:border-red-400/30 bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-400";
  return (
    <span className={`inline-block px-1.5 py-0.5 border-[0.5px] rounded text-[10px] font-medium ${style}`}>
      {score}
    </span>
  );
}
