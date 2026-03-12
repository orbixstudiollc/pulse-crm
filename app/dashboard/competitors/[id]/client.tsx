"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Button,
  Badge,
  Input,
  Textarea,
  PlusIcon,
  ArrowLeftIcon,
  XIcon,
  GlobeIcon,
  ShieldIcon,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  updateCompetitor,
  upsertBattleCard,
} from "@/lib/actions/competitors";

// ── Types ────────────────────────────────────────────────────────────────────

interface CompetitorData {
  id: string;
  name: string;
  website: string | null;
  category: string | null;
  description: string | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  [key: string]: unknown;
}

interface BattleCardData {
  id: string;
  competitor_id: string;
  their_strengths: string[] | null;
  their_weaknesses: string[] | null;
  our_advantages: string[] | null;
  switching_triggers: string[] | null;
  landmine_questions: string[] | null;
  positioning_statement: string | null;
  [key: string]: unknown;
}

const categoryBadgeVariant: Record<string, "green" | "amber" | "blue"> = {
  direct: "green",
  indirect: "amber",
  aspirational: "blue",
};

// ── Editable Tag Section ─────────────────────────────────────────────────────

function EditableTagSection({
  title,
  tags,
  onSave,
  isPending,
  color = "neutral",
}: {
  title: string;
  tags: string[];
  onSave: (tags: string[]) => void;
  isPending: boolean;
  color?: "green" | "red" | "blue" | "amber" | "neutral";
}) {
  const [editing, setEditing] = useState(false);
  const [localTags, setLocalTags] = useState<string[]>(tags);
  const [inputValue, setInputValue] = useState("");

  const addTag = () => {
    if (inputValue.trim()) {
      setLocalTags([...localTags, inputValue.trim()]);
      setInputValue("");
    }
  };

  const removeTag = (index: number) => {
    setLocalTags(localTags.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave(localTags);
    setEditing(false);
  };

  const handleCancel = () => {
    setLocalTags(tags);
    setInputValue("");
    setEditing(false);
  };

  const tagColorClasses: Record<string, string> = {
    green:
      "border-green-200 dark:border-green-400/30 bg-green-100 dark:bg-green-400/15 text-green-600 dark:text-green-400",
    red: "border-red-200 dark:border-red-400/30 bg-red-100 dark:bg-red-400/15 text-red-600 dark:text-red-400",
    blue: "border-blue-200 dark:border-blue-400/30 bg-blue-100 dark:bg-blue-400/15 text-blue-600 dark:text-blue-400",
    amber:
      "border-amber-200 dark:border-amber-400/30 bg-amber-100 dark:bg-amber-400/15 text-amber-600 dark:text-amber-400",
    neutral:
      "border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300",
  };

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {title}
        </h3>
        {!editing ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>

      {/* Tags display */}
      <div className="flex flex-wrap gap-2">
        {(editing ? localTags : tags).map((tag, i) => (
          <span
            key={i}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
              tagColorClasses[color]
            )}
          >
            {tag}
            {editing && (
              <button
                type="button"
                onClick={() => removeTag(i)}
                className="ml-0.5 hover:opacity-70"
              >
                <XIcon size={12} />
              </button>
            )}
          </span>
        ))}
        {(editing ? localTags : tags).length === 0 && !editing && (
          <p className="text-sm text-neutral-400 dark:text-neutral-500 italic">
            No items added yet
          </p>
        )}
      </div>

      {/* Add input when editing */}
      {editing && (
        <div className="flex gap-2">
          <Input
            placeholder="Type and press Enter to add"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
          />
          <Button variant="outline" onClick={addTag} className="shrink-0">
            <PlusIcon size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Editable List Section (for landmine questions) ───────────────────────────

function EditableListSection({
  title,
  items,
  onSave,
  isPending,
}: {
  title: string;
  items: string[];
  onSave: (items: string[]) => void;
  isPending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [localItems, setLocalItems] = useState<string[]>(items);
  const [inputValue, setInputValue] = useState("");

  const addItem = () => {
    if (inputValue.trim()) {
      setLocalItems([...localItems, inputValue.trim()]);
      setInputValue("");
    }
  };

  const removeItem = (index: number) => {
    setLocalItems(localItems.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave(localItems);
    setEditing(false);
  };

  const handleCancel = () => {
    setLocalItems(items);
    setInputValue("");
    setEditing(false);
  };

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {title}
        </h3>
        {!editing ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>

      {/* Items list */}
      <ul className="space-y-2">
        {(editing ? localItems : items).map((item, i) => (
          <li key={i} className="flex items-start gap-3 group">
            <span className="mt-2 text-neutral-400 dark:text-neutral-500 text-xs font-mono">
              {i + 1}.
            </span>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 flex-1">
              {item}
            </p>
            {editing && (
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="mt-0.5 text-neutral-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                <XIcon size={14} />
              </button>
            )}
          </li>
        ))}
        {(editing ? localItems : items).length === 0 && !editing && (
          <p className="text-sm text-neutral-400 dark:text-neutral-500 italic">
            No items added yet
          </p>
        )}
      </ul>

      {/* Add input when editing */}
      {editing && (
        <div className="flex gap-2">
          <Input
            placeholder="Add a question and press Enter"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
          />
          <Button variant="outline" onClick={addItem} className="shrink-0">
            <PlusIcon size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Editable Textarea Section ────────────────────────────────────────────────

function EditableTextareaSection({
  title,
  value,
  onSave,
  isPending,
}: {
  title: string;
  value: string;
  onSave: (value: string) => void;
  isPending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  const handleSave = () => {
    onSave(localValue);
    setEditing(false);
  };

  const handleCancel = () => {
    setLocalValue(value);
    setEditing(false);
  };

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {title}
        </h3>
        {!editing ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <Textarea
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          rows={4}
          placeholder="Write your positioning statement..."
        />
      ) : (
        <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
          {value || (
            <span className="text-neutral-400 dark:text-neutral-500 italic">
              No positioning statement yet
            </span>
          )}
        </p>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function CompetitorDetailClient({
  competitor,
  battleCard,
}: {
  competitor: CompetitorData;
  battleCard: BattleCardData | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Merge competitor strengths/weaknesses with battle card data
  const theirStrengths =
    battleCard?.their_strengths ?? competitor.strengths ?? [];
  const theirWeaknesses =
    battleCard?.their_weaknesses ?? competitor.weaknesses ?? [];
  const ourAdvantages = battleCard?.our_advantages ?? [];
  const switchingTriggers = battleCard?.switching_triggers ?? [];
  const landmineQuestions = battleCard?.landmine_questions ?? [];
  const positioningStatement = battleCard?.positioning_statement ?? "";

  // ── Save handlers ────────────────────────────────────────────────────────

  const saveBattleCardField = (
    field: string,
    value: string[] | string | null
  ) => {
    startTransition(async () => {
      const result = await upsertBattleCard(competitor.id, {
        [field]: value,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Battle card updated");
        router.refresh();
      }
    });
  };

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/competitors"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors"
      >
        <ArrowLeftIcon size={16} />
        Back to Competitors
      </Link>

      {/* Competitor Header */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
              <ShieldIcon
                size={24}
                className="text-neutral-950 dark:text-neutral-50"
              />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-[28px] leading-[36px] tracking-[-0.56px] font-serif text-neutral-950 dark:text-neutral-50">
                  {competitor.name}
                </h1>
                <Badge
                  variant={
                    categoryBadgeVariant[competitor.category || "direct"] ||
                    "neutral"
                  }
                >
                  {competitor.category || "direct"}
                </Badge>
              </div>
              {competitor.website && (
                <a
                  href={
                    competitor.website.startsWith("http")
                      ? competitor.website
                      : `https://${competitor.website}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors mt-1"
                >
                  <GlobeIcon size={14} />
                  {competitor.website}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {competitor.description && (
          <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-3xl">
            {competitor.description}
          </p>
        )}
      </div>

      {/* Battle Card Sections */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
          Battle Card
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Their Strengths */}
          <EditableTagSection
            title="Their Strengths"
            tags={theirStrengths}
            onSave={(tags) => saveBattleCardField("their_strengths", tags)}
            isPending={isPending}
            color="green"
          />

          {/* Their Weaknesses */}
          <EditableTagSection
            title="Their Weaknesses"
            tags={theirWeaknesses}
            onSave={(tags) => saveBattleCardField("their_weaknesses", tags)}
            isPending={isPending}
            color="red"
          />

          {/* Our Advantages */}
          <EditableTagSection
            title="Our Advantages"
            tags={ourAdvantages}
            onSave={(tags) => saveBattleCardField("our_advantages", tags)}
            isPending={isPending}
            color="blue"
          />

          {/* Switching Triggers */}
          <EditableTagSection
            title="Switching Triggers"
            tags={switchingTriggers}
            onSave={(tags) => saveBattleCardField("switching_triggers", tags)}
            isPending={isPending}
            color="amber"
          />
        </div>

        {/* Landmine Questions - full width */}
        <EditableListSection
          title="Landmine Questions"
          items={landmineQuestions}
          onSave={(items) => saveBattleCardField("landmine_questions", items)}
          isPending={isPending}
        />

        {/* Positioning Statement - full width */}
        <EditableTextareaSection
          title="Positioning Statement"
          value={positioningStatement}
          onSave={(value) =>
            saveBattleCardField("positioning_statement", value || null)
          }
          isPending={isPending}
        />
      </div>
    </div>
  );
}
