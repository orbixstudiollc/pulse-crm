"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  SparkleIcon,
  PencilSimpleIcon,
  CheckIcon,
  GlobeIcon,
  BrainIcon,
  TrashIcon,
} from "@/components/ui";
import { Page, PageHeader, Section } from "@/components/dashboard";
import type { Tables } from "@/types/database";
import {
  createMemoryItem,
  updateMemoryItem,
  deleteMemoryItem,
  scrapeWebsiteForMemory,
} from "@/lib/actions/copilot";
import { BTN_PRIMARY, BTN_OUTLINE, BTN_GHOST, FIELD, LABEL } from "./styles";

type MemoryItem = Tables<"copilot_memory">;

export function MemoryView({ items, setItems }: { items: MemoryItem[]; setItems: React.Dispatch<React.SetStateAction<MemoryItem[]>> }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    type: "business_details" as MemoryItem["type"],
    title: "",
    content: "",
  });

  // Scrape state
  const [scrapeMode, setScrapeMode] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapeResults, setScrapeResults] = useState<Array<{ type: MemoryItem["type"]; title: string; content: string; selected: boolean }> | null>(null);
  const [scrapeSiteName, setScrapeSiteName] = useState("");
  const [savingScrape, setSavingScrape] = useState(false);

  const memoryTypes = [
    { value: "business_details", label: "Business Details", desc: "Company info, industry, size" },
    { value: "product_info", label: "Product / Service", desc: "What you sell, pricing, features" },
    { value: "target_audience", label: "Target Audience", desc: "ICP, personas, verticals" },
    { value: "brand_voice", label: "Brand Voice", desc: "Tone, messaging guidelines" },
    { value: "custom", label: "Custom", desc: "Any other business context" },
  ];

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error("Title and content are required");
      return;
    }

    if (editingId) {
      const result = await updateMemoryItem(editingId, formData);
      if (result.success) {
        setItems(prev => prev.map(m => m.id === editingId ? { ...m, ...formData } : m));
        toast.success("Memory updated");
      }
    } else {
      const result = await createMemoryItem({ ...formData, source: "manual" });
      if (result.data) {
        setItems(prev => [result.data!, ...prev]);
        toast.success("Memory added");
      }
    }
    setShowForm(false);
    setEditingId(null);
    setFormData({ type: "business_details", title: "", content: "" });
  };

  const handleDelete = async (id: string) => {
    await deleteMemoryItem(id);
    setItems(prev => prev.filter(m => m.id !== id));
    toast.success("Memory deleted");
  };

  const handleEdit = (item: MemoryItem) => {
    setFormData({ type: item.type, title: item.title, content: item.content });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) {
      toast.error("Please enter a website URL");
      return;
    }
    setScraping(true);
    const result = await scrapeWebsiteForMemory(scrapeUrl.trim());
    setScraping(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    if (result.data) {
      setScrapeResults(result.data.map(item => ({ ...item, selected: true })));
      setScrapeSiteName(result.siteName || "website");
    }
  };

  const handleSaveScrapeResults = async () => {
    const selected = scrapeResults?.filter(r => r.selected) || [];
    if (selected.length === 0) {
      toast.error("Select at least one item to save");
      return;
    }

    setSavingScrape(true);
    let saved = 0;
    for (const item of selected) {
      const result = await createMemoryItem({
        type: item.type,
        title: item.title,
        content: item.content,
        source: "website",
        source_url: scrapeUrl.trim(),
      });
      if (result.data) {
        setItems(prev => [result.data!, ...prev]);
        saved++;
      }
    }
    setSavingScrape(false);

    if (saved > 0) {
      toast.success(`Saved ${saved} item${saved > 1 ? "s" : ""} from ${scrapeSiteName}`);
      setScrapeMode(false);
      setScrapeUrl("");
      setScrapeResults(null);
      setScrapeSiteName("");
    }
  };

  const exitScrapeMode = () => {
    setScrapeMode(false);
    setScrapeUrl("");
    setScrapeResults(null);
    setScrapeSiteName("");
    setScraping(false);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <Page>
        <PageHeader
          icon={<BrainIcon size={18} />}
          title="Memory"
          description="Pulse Copilot uses your business details to provide context-aware responses."
        />

        {showForm ? (
          /* Memory Form */
          <Section title={editingId ? "Edit Memory" : "Add Memory"}>
            <div className="max-w-[560px] space-y-4">
              <div>
                <label className={LABEL}>Type</label>
                <select
                  value={formData.type}
                  onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as MemoryItem["type"] }))}
                  className={cn(FIELD, "h-8")}
                >
                  {memoryTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={LABEL}>Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Company Overview"
                  className={cn(FIELD, "h-8")}
                />
              </div>

              <div>
                <label className={LABEL}>Content</label>
                <textarea
                  value={formData.content}
                  onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Describe your business, products, target audience, etc..."
                  rows={6}
                  className={cn(FIELD, "py-2 resize-none")}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button onClick={handleSave} className={BTN_PRIMARY}>
                  {editingId ? "Update" : "Save"}
                </button>
                <button
                  onClick={() => { setShowForm(false); setEditingId(null); setFormData({ type: "business_details", title: "", content: "" }); }}
                  className={BTN_OUTLINE}
                >
                  Cancel
                </button>
              </div>
            </div>
          </Section>
        ) : scrapeMode ? (
          /* Scrape Flow */
          scrapeResults === null ? (
            /* Phase A: URL Input */
            <Section
              title="Scan a website"
              icon={<SparkleIcon size={18} />}
              description="Enter your website URL and AI will automatically extract business details, products, audience, and brand voice."
            >
              <div className="flex max-w-[560px] gap-2">
                <input
                  type="url"
                  value={scrapeUrl}
                  onChange={e => setScrapeUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !scraping && handleScrape()}
                  placeholder="https://yourcompany.com"
                  disabled={scraping}
                  className={cn(FIELD, "h-8 flex-1 disabled:opacity-50")}
                />
                <button
                  onClick={handleScrape}
                  disabled={scraping || !scrapeUrl.trim()}
                  className={BTN_PRIMARY}
                >
                  {scraping ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Analyzing...
                    </>
                  ) : (
                    "Scan"
                  )}
                </button>
                <button
                  onClick={exitScrapeMode}
                  disabled={scraping}
                  className={BTN_GHOST}
                >
                  Cancel
                </button>
              </div>
            </Section>
          ) : (
            /* Phase B: Results Review */
            <Section
              title={<>Found {scrapeResults.length} item{scrapeResults.length > 1 ? "s" : ""} from {scrapeSiteName}</>}
              icon={<SparkleIcon size={16} />}
              actions={<span className="text-[13px] text-fg-muted">{scrapeResults.filter(r => r.selected).length} selected</span>}
            >
              <div className="max-h-[400px] overflow-y-auto border-t border-divider">
                {scrapeResults.map((result, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "py-4 border-b border-divider transition-opacity",
                      !result.selected && "opacity-60"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => setScrapeResults(prev => prev!.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r))}
                        className={cn(
                          "mt-0.5 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors",
                          result.selected
                            ? "bg-accent-surface border-accent text-accent-on-surface"
                            : "border-line"
                        )}
                      >
                        {result.selected && <CheckIcon size={12} />}
                      </button>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] px-2 py-0.5 rounded-full bg-muted text-fg-secondary font-medium">
                            {memoryTypes.find(t => t.value === result.type)?.label || result.type}
                          </span>
                        </div>
                        <input
                          type="text"
                          value={result.title}
                          onChange={e => setScrapeResults(prev => prev!.map((r, i) => i === idx ? { ...r, title: e.target.value } : r))}
                          className="w-full text-[14px] font-medium text-fg bg-transparent border-0 p-0 focus:outline-none focus:ring-0"
                        />
                        <textarea
                          value={result.content}
                          onChange={e => setScrapeResults(prev => prev!.map((r, i) => i === idx ? { ...r, content: e.target.value } : r))}
                          rows={2}
                          className="w-full text-[13px] text-fg-secondary bg-transparent border-0 p-0 focus:outline-none focus:ring-0 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-4">
                <button
                  onClick={handleSaveScrapeResults}
                  disabled={savingScrape || scrapeResults.filter(r => r.selected).length === 0}
                  className={BTN_PRIMARY}
                >
                  {savingScrape ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    `Save ${scrapeResults.filter(r => r.selected).length} selected`
                  )}
                </button>
                <button
                  onClick={() => { setScrapeResults(null); setScrapeUrl(""); }}
                  className={BTN_OUTLINE}
                >
                  Back
                </button>
                <button
                  onClick={exitScrapeMode}
                  className={BTN_GHOST}
                >
                  Cancel
                </button>
              </div>
            </Section>
          )
        ) : (
          <>
            {/* Quick Add Tiles */}
            <Section>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => {
                    setFormData({ type: "business_details", title: "Business Overview", content: "" });
                    setShowForm(true);
                  }}
                  data-clay-box className="flex w-[230px] items-start gap-3 rounded-lg bg-subtle p-4 text-left shadow-card transition-colors hover:bg-muted max-sm:w-full"
                >
                  <GlobeIcon size={18} className="mt-0.5 shrink-0 text-accent" />
                  <div>
                    <p className="text-[14px] font-semibold text-fg">Add business details</p>
                    <p className="text-[13px] text-fg-muted mt-0.5">Company info, products</p>
                  </div>
                </button>
                <button
                  onClick={() => setScrapeMode(true)}
                  data-clay-box className="flex w-[230px] items-start gap-3 rounded-lg bg-subtle p-4 text-left shadow-card transition-colors hover:bg-muted max-sm:w-full"
                >
                  <SparkleIcon size={18} className="mt-0.5 shrink-0 text-accent" />
                  <div>
                    <p className="text-[14px] font-semibold text-fg">Scan a website</p>
                    <p className="text-[13px] text-fg-muted mt-0.5">Auto-extract with AI</p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setFormData({ type: "custom", title: "", content: "" });
                    setShowForm(true);
                  }}
                  data-clay-box className="flex w-[230px] items-start gap-3 rounded-lg bg-subtle p-4 text-left shadow-card transition-colors hover:bg-muted max-sm:w-full"
                >
                  <PencilSimpleIcon size={18} className="mt-0.5 shrink-0 text-accent" />
                  <div>
                    <p className="text-[14px] font-semibold text-fg">Edit manually</p>
                    <p className="text-[13px] text-fg-muted mt-0.5">Custom business context</p>
                  </div>
                </button>
              </div>
            </Section>

            {/* Existing Memory Items */}
            {items.length > 0 && (
              <Section title="Saved Context">
                <div className="border-t border-divider">
                  {items.map(item => (
                    <div key={item.id} className="group flex items-start justify-between py-3 border-b border-divider">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[12px] px-2 py-0.5 rounded-full bg-muted text-fg-secondary font-medium">
                            {memoryTypes.find(t => t.value === item.type)?.label || item.type}
                          </span>
                          {item.source === "scrape" && (
                            <span className="text-[12px] px-2 py-0.5 rounded-full bg-accent-surface text-accent-on-surface">Website</span>
                          )}
                          {!item.is_active && (
                            <span className="text-[12px] px-2 py-0.5 rounded-full bg-warning-surface text-warning">Disabled</span>
                          )}
                        </div>
                        <h4 className="text-[14px] font-medium text-fg">{item.title}</h4>
                        <p className="text-[13px] text-fg-muted mt-1 line-clamp-2">{item.content}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3">
                        <button onClick={() => handleEdit(item)} className="p-1.5 rounded hover:bg-subtle transition-colors">
                          <PencilSimpleIcon size={14} className="text-fg-muted" />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-danger-surface transition-colors">
                          <TrashIcon size={14} className="text-danger" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </Page>
    </div>
  );
}
