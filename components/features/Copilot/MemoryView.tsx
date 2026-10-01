"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  SparkleIcon,
  PencilSimpleIcon,
  CheckIcon,
  BrainIcon,
  TrashIcon,
  PlusIcon,
  ArrowUpRightIcon,
} from "@/components/ui";
import { Page, PageHeader, PageTabs, Section } from "@/components/dashboard";
import type { CopilotMemoryType, Tables } from "@/types/database";
import {
  createMemoryItem,
  updateMemoryItem,
  deleteMemoryItem,
  scrapeWebsiteForMemory,
  listMemoryByType,
  saveGuidance,
  listIcpProfiles,
} from "@/lib/actions/copilot";
import { BTN_PRIMARY, BTN_OUTLINE, BTN_GHOST, FIELD, LABEL } from "./styles";

type MemoryItem = Tables<"copilot_memory">;
type SetItems = React.Dispatch<React.SetStateAction<MemoryItem[]>>;
type IcpProfileRow = { id: string; name: string; description: string | null; is_primary: boolean };
type Tab = "business" | "profiles" | "guidance" | "saved";
type Editor = { type: CopilotMemoryType; id: string | null };

const GUIDANCE_LIMIT = 10;
const GUIDANCE_MAX_LENGTH = 500;
const ICON_BTN = "rounded p-1.5 text-fg-muted transition-colors hover:bg-subtle hover:text-fg";
const PILL = "rounded-full bg-muted px-2 py-0.5 text-[12px] font-medium text-fg-secondary";
const LINK_ACTION = "inline-flex items-center gap-1 text-[13px] font-medium text-accent-strong hover:underline";

const BUSINESS_TYPES: Array<{ value: CopilotMemoryType; label: string; desc: string }> = [
  { value: "business_details", label: "Business details", desc: "Company info, industry, size" },
  { value: "product_info", label: "Product / service", desc: "What you sell, pricing, features" },
  { value: "brand_voice", label: "Brand voice", desc: "Tone, messaging guidelines" },
  { value: "target_audience", label: "Target audience", desc: "Who you sell to, personas, verticals" },
];

const SOURCE_LABEL: Record<MemoryItem["source"], string> = {
  copilot: "Copilot",
  user: "User",
  scrape: "Scrape",
};

const typeLabel = (type: string) =>
  BUSINESS_TYPES.find(t => t.value === type)?.label ?? (type === "custom" ? "Saved" : type);

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function ItemEditor({
  item,
  placeholder,
  onSave,
  onCancel,
}: {
  item: MemoryItem | null;
  placeholder: string;
  onSave: (data: { title: string; content: string }) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [content, setContent] = useState(item?.content ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setSaving(true);
    await onSave({ title: title.trim(), content: content.trim() });
    setSaving(false);
  };

  return (
    <div className="max-w-[560px] space-y-4 py-4">
      <div>
        <label className={LABEL}>Title</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Company overview"
          className={cn(FIELD, "h-8")}
        />
      </div>
      <div>
        <label className={LABEL}>Content</label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={placeholder}
          rows={5}
          className={cn(FIELD, "resize-none py-2")}
        />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={submit} disabled={saving} className={BTN_PRIMARY}>
          {item ? "Update" : "Save"}
        </button>
        <button onClick={onCancel} className={BTN_OUTLINE}>Cancel</button>
      </div>
    </div>
  );
}

function MemoryRow({
  item,
  showSource,
  actions,
}: {
  item: MemoryItem;
  showSource?: boolean;
  actions: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-divider py-3">
      <div className={cn("min-w-0 flex-1", !item.is_active && "opacity-60")}>
        <div className="mb-1 flex items-center gap-2">
          <h4 className="truncate text-[13px] font-medium text-fg">{item.title}</h4>
          {showSource && <span className={PILL}>{SOURCE_LABEL[item.source]}</span>}
          {!item.is_active && <span className={PILL}>Inactive</span>}
        </div>
        <p className="line-clamp-2 text-[13px] text-fg-muted">{item.content}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">{actions}</div>
    </div>
  );
}

function ScanWebsite({ onSaved, onExit }: { onSaved: (item: MemoryItem) => void; onExit: () => void }) {
  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<Array<{ type: CopilotMemoryType; title: string; content: string; selected: boolean }> | null>(null);
  const [siteName, setSiteName] = useState("");
  const [saving, setSaving] = useState(false);

  const scan = async () => {
    if (!url.trim()) {
      toast.error("Please enter a website URL");
      return;
    }
    setScanning(true);
    const result = await scrapeWebsiteForMemory(url.trim());
    setScanning(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.data) {
      setResults(result.data.map(item => ({ ...item, selected: true })));
      setSiteName(result.siteName || "website");
    }
  };

  const saveSelected = async () => {
    const selected = results?.filter(r => r.selected) ?? [];
    if (selected.length === 0) {
      toast.error("Select at least one item to save");
      return;
    }
    setSaving(true);
    let saved = 0;
    for (const item of selected) {
      const result = await createMemoryItem({
        type: item.type,
        title: item.title,
        content: item.content,
        source: "scrape",
        source_url: url.trim(),
      });
      if (result.data) {
        onSaved(result.data);
        saved++;
      }
    }
    setSaving(false);
    if (saved > 0) {
      toast.success(`Saved ${saved} item${saved > 1 ? "s" : ""} from ${siteName}`);
      onExit();
    }
  };

  const patch = (idx: number, change: Partial<{ title: string; content: string; selected: boolean }>) =>
    setResults(prev => prev!.map((r, i) => (i === idx ? { ...r, ...change } : r)));

  if (results === null) {
    return (
      <Section
        title="Scan a website"
        icon={<SparkleIcon size={18} />}
        description="Enter your website URL and AI will extract business details, products, audience, and brand voice."
      >
        <div className="flex max-w-[560px] gap-2">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !scanning && scan()}
            placeholder="https://yourcompany.com"
            disabled={scanning}
            className={cn(FIELD, "h-8 flex-1 disabled:opacity-50")}
          />
          <button onClick={scan} disabled={scanning || !url.trim()} className={BTN_PRIMARY}>
            {scanning ? <><Spinner />Analyzing...</> : "Scan"}
          </button>
          <button onClick={onExit} disabled={scanning} className={BTN_GHOST}>Cancel</button>
        </div>
      </Section>
    );
  }

  const selectedCount = results.filter(r => r.selected).length;
  return (
    <Section
      title={<>Found {results.length} item{results.length > 1 ? "s" : ""} from {siteName}</>}
      icon={<SparkleIcon size={16} />}
      actions={<span className="text-[13px] text-fg-muted">{selectedCount} selected</span>}
    >
      <div className="max-h-[400px] overflow-y-auto border-t border-divider">
        {results.map((result, idx) => (
          <div
            key={idx}
            className={cn("border-b border-divider py-4 transition-opacity", !result.selected && "opacity-60")}
          >
            <div className="flex items-start gap-3">
              <button
                onClick={() => patch(idx, { selected: !result.selected })}
                aria-label={result.selected ? "Deselect item" : "Select item"}
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                  result.selected ? "border-accent bg-accent-surface text-accent-on-surface" : "border-line",
                )}
              >
                {result.selected && <CheckIcon size={12} />}
              </button>
              <div className="min-w-0 flex-1 space-y-2">
                <span className={PILL}>{typeLabel(result.type)}</span>
                <input
                  type="text"
                  value={result.title}
                  onChange={e => patch(idx, { title: e.target.value })}
                  className="w-full border-0 bg-transparent p-0 text-[13px] font-medium text-fg focus:outline-none focus:ring-0"
                />
                <textarea
                  value={result.content}
                  onChange={e => patch(idx, { content: e.target.value })}
                  rows={2}
                  className="w-full resize-none border-0 bg-transparent p-0 text-[13px] text-fg-secondary focus:outline-none focus:ring-0"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-4">
        <button onClick={saveSelected} disabled={saving || selectedCount === 0} className={BTN_PRIMARY}>
          {saving ? <><Spinner />Saving...</> : `Save ${selectedCount} selected`}
        </button>
        <button onClick={() => { setResults(null); setUrl(""); }} className={BTN_OUTLINE}>Back</button>
        <button onClick={onExit} className={BTN_GHOST}>Cancel</button>
      </div>
    </Section>
  );
}

function BusinessTab({
  items,
  editor,
  setEditor,
  onSaveItem,
  onDelete,
  onScanned,
}: {
  items: MemoryItem[];
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
  onSaveItem: (type: CopilotMemoryType, id: string | null, data: { title: string; content: string }) => Promise<boolean>;
  onDelete: (id: string) => void;
  onScanned: (item: MemoryItem) => void;
}) {
  const [scanning, setScanning] = useState(false);

  if (scanning) return <ScanWebsite onSaved={onScanned} onExit={() => setScanning(false)} />;

  return (
    <>
      <Section
        title="Scan a website"
        description="Extract business details, products, audience, and brand voice from your site."
        actions={<button onClick={() => setScanning(true)} className={BTN_OUTLINE}><SparkleIcon size={14} />Scan</button>}
      />
      {BUSINESS_TYPES.map(({ value, label, desc }) => {
        const rows = items.filter(m => m.type === value);
        const editing = editor?.type === value ? editor : null;
        return (
          <Section
            key={value}
            title={label}
            description={desc}
            actions={
              !editing && (
                <button onClick={() => setEditor({ type: value, id: null })} className={BTN_OUTLINE}>
                  <PlusIcon size={14} />Add
                </button>
              )
            }
          >
            {editing && !editing.id && (
              <ItemEditor
                item={null}
                placeholder={desc}
                onSave={data => onSaveItem(value, null, data)}
                onCancel={() => setEditor(null)}
              />
            )}
            {rows.length === 0 && !editing ? (
              <p className="text-[13px] text-fg-muted">Nothing saved yet.</p>
            ) : (
              <div className="border-t border-divider">
                {rows.map(item =>
                  editing?.id === item.id ? (
                    <ItemEditor
                      key={item.id}
                      item={item}
                      placeholder={desc}
                      onSave={data => onSaveItem(value, item.id, data)}
                      onCancel={() => setEditor(null)}
                    />
                  ) : (
                    <MemoryRow
                      key={item.id}
                      item={item}
                      showSource
                      actions={
                        <>
                          <button onClick={() => setEditor({ type: value, id: item.id })} aria-label="Edit" className={ICON_BTN}>
                            <PencilSimpleIcon size={14} />
                          </button>
                          <button onClick={() => onDelete(item.id)} aria-label="Delete" className={cn(ICON_BTN, "hover:text-danger")}>
                            <TrashIcon size={14} />
                          </button>
                        </>
                      }
                    />
                  ),
                )}
              </div>
            )}
          </Section>
        );
      })}
      <Section
        title="Competitors"
        description="Competitor profiles are managed on the Competitors page."
        actions={
          <Link href="/dashboard/competitors" className={LINK_ACTION}>
            Open competitors<ArrowUpRightIcon size={14} />
          </Link>
        }
      />
    </>
  );
}

function ProfilesTab() {
  const [profiles, setProfiles] = useState<IcpProfileRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listIcpProfiles().then(res => {
      if (cancelled) return;
      if (res.error) setError(res.error);
      else setProfiles(res.data);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <Section
      title="Customer profiles"
      description="Ideal customer profiles Copilot can use when it finds and scores leads."
      actions={
        <Link href="/dashboard/icp" className={LINK_ACTION}>
          Manage profiles<ArrowUpRightIcon size={14} />
        </Link>
      }
    >
      {error ? (
        <p className="text-[13px] text-danger">{error}</p>
      ) : profiles === null ? (
        <p className="text-[13px] text-fg-muted">Loading...</p>
      ) : profiles.length === 0 ? (
        <p className="text-[13px] text-fg-muted">No customer profiles yet. Create one on the ICP page.</p>
      ) : (
        <div className="border-t border-divider">
          {profiles.map(p => (
            <Link
              key={p.id}
              href={`/dashboard/icp/${p.id}`}
              className="flex items-start justify-between gap-3 border-b border-divider py-3 hover:bg-subtle"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="truncate text-[13px] font-medium text-fg">{p.name}</h4>
                  {p.is_primary && <span className={PILL}>Primary</span>}
                </div>
                {p.description && <p className="mt-1 line-clamp-2 text-[13px] text-fg-muted">{p.description}</p>}
              </div>
              <ArrowUpRightIcon size={14} className="mt-1 shrink-0 text-fg-muted" />
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}

function GuidanceTab({
  items,
  onSaved,
  onToggleActive,
}: {
  items: MemoryItem[];
  onSaved: (item: MemoryItem) => void;
  onToggleActive: (item: MemoryItem) => void;
}) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const rules = [...items].sort((a, b) => Number(b.is_active) - Number(a.is_active));
  const activeCount = rules.filter(r => r.is_active).length;
  const atCap = activeCount >= GUIDANCE_LIMIT;

  const submit = async (content: string, id?: string) => {
    setBusy(true);
    const result = await saveGuidance(content, id);
    setBusy(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? "Could not save guidance");
      return false;
    }
    onSaved(result.data);
    return true;
  };

  return (
    <Section
      title="Guidance"
      description="Standing rules Copilot follows in every conversation, such as tone, formatting, or things to avoid."
      actions={<span className="text-[13px] font-medium text-fg-secondary">{activeCount} of {GUIDANCE_LIMIT}</span>}
    >
      <div className="max-w-[560px] space-y-3 pb-4">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          maxLength={GUIDANCE_MAX_LENGTH}
          rows={2}
          disabled={atCap}
          aria-label="New guidance rule"
          placeholder="e.g. Always write in British English"
          className={cn(FIELD, "resize-none py-2 disabled:opacity-50")}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={async () => { if (await submit(draft)) setDraft(""); }}
            disabled={busy || atCap || !draft.trim()}
            className={BTN_PRIMARY}
          >
            Add rule
          </button>
          {atCap && <span className="text-[13px] text-fg-muted">Deactivate a rule to add another.</span>}
        </div>
      </div>
      {rules.length === 0 ? (
        <p className="text-[13px] text-fg-muted">No guidance yet.</p>
      ) : (
        <div className="border-t border-divider">
          {rules.map(rule =>
            editingId === rule.id ? (
              <div key={rule.id} className="max-w-[560px] space-y-3 border-b border-divider py-3">
                <textarea
                  value={editDraft}
                  onChange={e => setEditDraft(e.target.value)}
                  maxLength={GUIDANCE_MAX_LENGTH}
                  rows={3}
                  aria-label="Edit guidance rule"
                  className={cn(FIELD, "resize-none py-2")}
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => { if (await submit(editDraft, rule.id)) setEditingId(null); }}
                    disabled={busy || !editDraft.trim()}
                    className={BTN_PRIMARY}
                  >
                    Update
                  </button>
                  <button onClick={() => setEditingId(null)} className={BTN_OUTLINE}>Cancel</button>
                </div>
              </div>
            ) : (
              <div key={rule.id} className="flex items-start justify-between gap-3 border-b border-divider py-3">
                <p className={cn("min-w-0 flex-1 whitespace-pre-wrap text-[13px] text-fg", !rule.is_active && "opacity-60")}>
                  {rule.content}
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => { setEditingId(rule.id); setEditDraft(rule.content); }}
                    aria-label="Edit"
                    className={ICON_BTN}
                  >
                    <PencilSimpleIcon size={14} />
                  </button>
                  <button
                    onClick={() => onToggleActive(rule)}
                    disabled={!rule.is_active && atCap}
                    className={cn(BTN_GHOST, "disabled:opacity-50")}
                  >
                    {rule.is_active ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </Section>
  );
}

function SavedTab({
  items,
  editor,
  setEditor,
  onSaveItem,
  onToggleActive,
}: {
  items: MemoryItem[];
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
  onSaveItem: (type: CopilotMemoryType, id: string | null, data: { title: string; content: string }) => Promise<boolean>;
  onToggleActive: (item: MemoryItem) => void;
}) {
  const editing = editor?.type === "custom" ? editor : null;
  const placeholder = "Anything Copilot should remember about your business";

  return (
    <Section
      title="Saved"
      description="Things Copilot has saved, plus notes you add yourself. Inactive items are not used."
      actions={
        !editing && (
          <button onClick={() => setEditor({ type: "custom", id: null })} className={BTN_OUTLINE}>
            <PlusIcon size={14} />Add
          </button>
        )
      }
    >
      {editing && !editing.id && (
        <ItemEditor
          item={null}
          placeholder={placeholder}
          onSave={data => onSaveItem("custom", null, data)}
          onCancel={() => setEditor(null)}
        />
      )}
      {items.length === 0 && !editing ? (
        <p className="text-[13px] text-fg-muted">Nothing saved yet.</p>
      ) : (
        <div className="border-t border-divider">
          {items.map(item =>
            editing?.id === item.id ? (
              <ItemEditor
                key={item.id}
                item={item}
                placeholder={placeholder}
                onSave={data => onSaveItem("custom", item.id, data)}
                onCancel={() => setEditor(null)}
              />
            ) : (
              <MemoryRow
                key={item.id}
                item={item}
                showSource
                actions={
                  <>
                    <button onClick={() => setEditor({ type: "custom", id: item.id })} aria-label="Edit" className={ICON_BTN}>
                      <PencilSimpleIcon size={14} />
                    </button>
                    <button onClick={() => onToggleActive(item)} className={BTN_GHOST}>
                      {item.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </>
                }
              />
            ),
          )}
        </div>
      )}
    </Section>
  );
}

export function MemoryView({ items, setItems }: { items: MemoryItem[]; setItems: SetItems }) {
  const [tab, setTab] = useState<Tab>("business");
  const [editor, setEditor] = useState<Editor | null>(null);

  // Guidance and saved items can change outside this view (Copilot writes them), so reload on entry.
  useEffect(() => {
    if (tab !== "guidance" && tab !== "saved") return;
    const types: CopilotMemoryType[] = tab === "guidance" ? ["guidance"] : ["custom"];
    let cancelled = false;
    listMemoryByType(types).then(res => {
      if (cancelled || res.error) return;
      setItems(prev => [...res.data, ...prev.filter(m => !types.includes(m.type))]);
    });
    return () => { cancelled = true; };
  }, [tab, setItems]);

  const upsert = (item: MemoryItem) =>
    setItems(prev => (prev.some(m => m.id === item.id) ? prev.map(m => (m.id === item.id ? item : m)) : [item, ...prev]));

  const handleSaveItem = async (type: CopilotMemoryType, id: string | null, data: { title: string; content: string }) => {
    if (id) {
      const result = await updateMemoryItem(id, data);
      if (result.error) {
        toast.error(result.error);
        return false;
      }
      setItems(prev => prev.map(m => (m.id === id ? { ...m, ...data } : m)));
      toast.success("Memory updated");
    } else {
      const result = await createMemoryItem({ type, ...data, source: "user" });
      if (!result.data) {
        toast.error(result.error ?? "Could not save");
        return false;
      }
      upsert(result.data);
      toast.success("Memory added");
    }
    setEditor(null);
    return true;
  };

  const handleDelete = async (id: string) => {
    const result = await deleteMemoryItem(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setItems(prev => prev.filter(m => m.id !== id));
    toast.success("Memory deleted");
  };

  const handleToggleActive = async (item: MemoryItem) => {
    const result = await updateMemoryItem(item.id, { is_active: !item.is_active });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setItems(prev => prev.map(m => (m.id === item.id ? { ...m, is_active: !item.is_active } : m)));
  };

  const switchTab = (next: Tab) => {
    setEditor(null);
    setTab(next);
  };

  const guidance = items.filter(m => m.type === "guidance");
  const saved = items.filter(m => m.type === "custom");

  return (
    <div className="flex-1 overflow-y-auto">
      <Page>
        <PageHeader
          icon={<BrainIcon size={18} />}
          title="Memory"
          description="Pulse Copilot uses this context to give answers that fit your business."
        />
        <PageTabs
          tabs={[
            { id: "business", label: "Business" },
            { id: "profiles", label: "Customer profiles" },
            { id: "guidance", label: "Guidance", count: `${guidance.filter(g => g.is_active).length}/${GUIDANCE_LIMIT}` },
            { id: "saved", label: "Saved", count: saved.length },
          ]}
          value={tab}
          onChange={switchTab}
        />
        {tab === "business" && (
          <BusinessTab
            items={items}
            editor={editor}
            setEditor={setEditor}
            onSaveItem={handleSaveItem}
            onDelete={handleDelete}
            onScanned={upsert}
          />
        )}
        {tab === "profiles" && <ProfilesTab />}
        {tab === "guidance" && <GuidanceTab items={guidance} onSaved={upsert} onToggleActive={handleToggleActive} />}
        {tab === "saved" && (
          <SavedTab
            items={saved}
            editor={editor}
            setEditor={setEditor}
            onSaveItem={handleSaveItem}
            onToggleActive={handleToggleActive}
          />
        )}
      </Page>
    </div>
  );
}
