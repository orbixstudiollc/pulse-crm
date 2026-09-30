"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Button,
  Badge,
  Input,
  Textarea,
  PlusIcon,
  XIcon,
  ShieldIcon,
} from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
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
  pricing?: unknown;
  created_at: string;
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

const categoryBadgeVariant: Record<string, "success" | "warning" | "info"> = {
  direct: "success",
  indirect: "warning",
  aspirational: "info",
};

// Same labels as the category tabs on the competitors list
const categoryLabels: Record<string, string> = {
  direct: "Direct",
  indirect: "Indirect",
  aspirational: "Aspirational",
};

// Scalar entries of the pricing JSON (e.g. { starting_price: "$49/mo" })
function pricingEntries(pricing: unknown): [string, string][] {
  if (!pricing || typeof pricing !== "object" || Array.isArray(pricing)) {
    return [];
  }
  return Object.entries(pricing as Record<string, unknown>)
    .filter(([, v]) => ["string", "number", "boolean"].includes(typeof v))
    .map(([k, v]) => [
      k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
      String(v),
    ]);
}

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
      "border-success bg-success-surface text-success",
    red: "border-danger bg-danger-surface text-danger",
    blue: "border-accent bg-accent-surface text-accent-on-surface",
    amber:
      "border-warning bg-warning-surface text-warning",
    neutral:
      "border-line bg-muted text-fg-secondary",
  };

  return (
    <Section
      title={title}
      actions={
        !editing ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-3">
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
            <p className="text-sm text-fg-secondary italic">
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
    </Section>
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
    <Section
      title={title}
      actions={
        !editing ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-3">
        {/* Items list */}
        <ul className="space-y-2">
          {(editing ? localItems : items).map((item, i) => (
            <li key={i} className="flex items-start gap-3 group">
              <span className="mt-2 text-fg-muted text-xs font-mono">
                {i + 1}.
              </span>
              <p className="text-sm text-fg flex-1">
                {item}
              </p>
              {editing && (
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  className="mt-0.5 text-fg-muted hover:text-danger transition-colors"
                >
                  <XIcon size={14} />
                </button>
              )}
            </li>
          ))}
          {(editing ? localItems : items).length === 0 && !editing && (
            <p className="text-sm text-fg-secondary italic">
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
    </Section>
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
    <Section
      title={title}
      actions={
        !editing ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-3">
        {editing ? (
          <Textarea
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            rows={4}
            placeholder="Write your positioning statement..."
          />
        ) : (
          <p className="text-sm text-fg whitespace-pre-wrap">
            {value || (
              <span className="text-fg-muted italic">
                No positioning statement yet
              </span>
            )}
          </p>
        )}
      </div>
    </Section>
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

  usePageHeader({
    backHref: "/dashboard/competitors",
    breadcrumbLabel: competitor.name,
  });

  // Strengths/weaknesses come from the competitor's own columns, as on the list card
  const strengths = competitor.strengths ?? [];
  const weaknesses = competitor.weaknesses ?? [];
  const ourAdvantages = battleCard?.our_advantages ?? [];
  const switchingTriggers = battleCard?.switching_triggers ?? [];
  const landmineQuestions = battleCard?.landmine_questions ?? [];
  const positioningStatement = battleCard?.positioning_statement ?? "";

  const category = competitor.category || "direct";
  const pricing = pricingEntries(competitor.pricing);

  // ── Save handlers ────────────────────────────────────────────────────────

  const saveCompetitorField = (
    field: "strengths" | "weaknesses",
    value: string[]
  ) => {
    startTransition(async () => {
      const result = await updateCompetitor(competitor.id, {
        [field]: value,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Competitor updated");
        router.refresh();
      }
    });
  };

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
    <Page>
      {/* Competitor Header */}
      <PageHeader icon={<ShieldIcon size={18} />} title={competitor.name} />

      {/* Description */}
      {competitor.description && (
        <div className="px-8 pb-6 max-sm:px-4">
          <p className="text-sm text-fg-secondary leading-relaxed max-w-3xl">
            {competitor.description}
          </p>
        </div>
      )}

      <DetailLayout
        className="border-t border-divider"
        aside={
          <PanelSection title="Details">
            <KeyValueList>
              <KeyValue label="Category">
                <Badge variant={categoryBadgeVariant[category] || "neutral"}>
                  {categoryLabels[category] ?? category}
                </Badge>
              </KeyValue>
              {competitor.website && (
                <KeyValue label="Website">
                  <a
                    href={
                      competitor.website.startsWith("http")
                        ? competitor.website
                        : `https://${competitor.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-fg-secondary hover:text-fg transition-colors"
                  >
                    {competitor.website}
                  </a>
                </KeyValue>
              )}
              {pricing.map(([label, value]) => (
                <KeyValue key={label} label={label}>
                  {value}
                </KeyValue>
              ))}
              <KeyValue label="Created">
                {formatDate(competitor.created_at)}
              </KeyValue>
            </KeyValueList>
          </PanelSection>
        }
      >
        <div>
          {/* Strengths */}
          <EditableTagSection
            title="Strengths"
            tags={strengths}
            onSave={(tags) => saveCompetitorField("strengths", tags)}
            isPending={isPending}
            color="green"
          />

          {/* Weaknesses */}
          <EditableTagSection
            title="Weaknesses"
            tags={weaknesses}
            onSave={(tags) => saveCompetitorField("weaknesses", tags)}
            isPending={isPending}
            color="red"
          />
        </div>

        {/* Battle Card Sections */}
        <div className="flex h-14 items-center px-8 border-t border-divider max-sm:px-4">
          <h2 className="text-[18px] leading-6 font-semibold text-fg">
            Battle Card
          </h2>
        </div>
        <div>
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
      </DetailLayout>
    </Page>
  );
}
