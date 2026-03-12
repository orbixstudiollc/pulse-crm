"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Button,
  Badge,
  Modal,
  Input,
  Select,
  Textarea,
  ActionMenu,
  PlusIcon,
  TrashIcon,
  PencilSimpleIcon,
  EyeIcon,
  XIcon,
  GlobeIcon,
  ShieldIcon,
  SparkleIcon,
} from "@/components/ui";
import { PageHeader, StatCard, EmptyState } from "@/components/dashboard";
import { AIActionButton, AIGenerateModal } from "@/components/features";
import { cn } from "@/lib/utils";
import {
  createCompetitor,
  updateCompetitor,
  deleteCompetitor,
} from "@/lib/actions/competitors";
import { aiGenerateBattleCard, aiAnalyzeCompetitor } from "@/lib/actions/ai-competitors";

// ── Types ────────────────────────────────────────────────────────────────────

interface CompetitorRecord {
  id: string;
  name: string;
  website: string | null;
  category: string | null;
  description: string | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  created_at: string;
  [key: string]: unknown;
}

type CategoryFilter = "all" | "direct" | "indirect" | "aspirational";

const categoryTabs: { label: string; value: CategoryFilter }[] = [
  { label: "All", value: "all" },
  { label: "Direct", value: "direct" },
  { label: "Indirect", value: "indirect" },
  { label: "Aspirational", value: "aspirational" },
];

const categoryBadgeVariant: Record<string, "green" | "amber" | "blue"> = {
  direct: "green",
  indirect: "amber",
  aspirational: "blue",
};

const categoryOptions = [
  { label: "Direct", value: "direct" },
  { label: "Indirect", value: "indirect" },
  { label: "Aspirational", value: "aspirational" },
];

// ── Component ────────────────────────────────────────────────────────────────

export function CompetitorsPageClient({
  initialCompetitors,
}: {
  initialCompetitors: CompetitorRecord[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<CategoryFilter>("all");
  const [showModal, setShowModal] = useState(false);
  const [editingCompetitor, setEditingCompetitor] =
    useState<CompetitorRecord | null>(null);

  // AI state
  const [aiBattleCardOpen, setAIBattleCardOpen] = useState(false);
  const [aiSwotOpen, setAISwotOpen] = useState(false);
  const [selectedCompetitorForAI, setSelectedCompetitorForAI] = useState<string | null>(null);
  const [selectedCompetitorName, setSelectedCompetitorName] = useState<string>("");

  // Form state
  const [formName, setFormName] = useState("");
  const [formWebsite, setFormWebsite] = useState("");
  const [formCategory, setFormCategory] = useState("direct");
  const [formDescription, setFormDescription] = useState("");
  const [formStrengths, setFormStrengths] = useState<string[]>([]);
  const [formWeaknesses, setFormWeaknesses] = useState<string[]>([]);
  const [strengthInput, setStrengthInput] = useState("");
  const [weaknessInput, setWeaknessInput] = useState("");

  const competitors = initialCompetitors;

  // Filtered competitors
  const filteredCompetitors =
    activeTab === "all"
      ? competitors
      : competitors.filter((c) => c.category === activeTab);

  // Stats
  const totalCount = competitors.length;
  const directCount = competitors.filter(
    (c) => c.category === "direct"
  ).length;
  const indirectCount = competitors.filter(
    (c) => c.category === "indirect"
  ).length;

  // ── Form helpers ─────────────────────────────────────────────────────────

  const resetForm = () => {
    setFormName("");
    setFormWebsite("");
    setFormCategory("direct");
    setFormDescription("");
    setFormStrengths([]);
    setFormWeaknesses([]);
    setStrengthInput("");
    setWeaknessInput("");
    setEditingCompetitor(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (competitor: CompetitorRecord) => {
    setEditingCompetitor(competitor);
    setFormName(competitor.name);
    setFormWebsite(competitor.website || "");
    setFormCategory(competitor.category || "direct");
    setFormDescription(competitor.description || "");
    setFormStrengths(competitor.strengths || []);
    setFormWeaknesses(competitor.weaknesses || []);
    setStrengthInput("");
    setWeaknessInput("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const addStrength = () => {
    if (strengthInput.trim()) {
      setFormStrengths([...formStrengths, strengthInput.trim()]);
      setStrengthInput("");
    }
  };

  const removeStrength = (index: number) => {
    setFormStrengths(formStrengths.filter((_, i) => i !== index));
  };

  const addWeakness = () => {
    if (weaknessInput.trim()) {
      setFormWeaknesses([...formWeaknesses, weaknessInput.trim()]);
      setWeaknessInput("");
    }
  };

  const removeWeakness = (index: number) => {
    setFormWeaknesses(formWeaknesses.filter((_, i) => i !== index));
  };

  // ── Mutations ────────────────────────────────────────────────────────────

  const handleSubmit = () => {
    if (!formName.trim()) {
      toast.error("Name is required");
      return;
    }

    startTransition(async () => {
      const payload = {
        name: formName.trim(),
        website: formWebsite.trim() || undefined,
        category: formCategory,
        description: formDescription.trim() || undefined,
        strengths: formStrengths,
        weaknesses: formWeaknesses,
      };

      if (editingCompetitor) {
        const result = await updateCompetitor(editingCompetitor.id, payload);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Competitor updated");
          closeModal();
          router.refresh();
        }
      } else {
        const result = await createCompetitor(payload);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Competitor created");
          closeModal();
          router.refresh();
        }
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteCompetitor(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Competitor deleted");
        router.refresh();
      }
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 space-y-4">
      {/* Header */}
      <PageHeader title="Competitors">
        <Button
          leftIcon={<PlusIcon size={20} weight="bold" />}
          onClick={openCreateModal}
        >
          Add Competitor
        </Button>
      </PageHeader>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Competitors"
          value={totalCount.toString()}
          icon={
            <ShieldIcon
              size={24}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
        <StatCard
          label="Direct"
          value={directCount.toString()}
          icon={
            <ShieldIcon
              size={24}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
        <StatCard
          label="Indirect"
          value={indirectCount.toString()}
          icon={
            <ShieldIcon
              size={24}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 p-1 rounded bg-neutral-100 dark:bg-neutral-900 w-fit">
        {categoryTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded whitespace-nowrap transition-colors",
              activeTab === tab.value
                ? "bg-neutral-950 dark:bg-white text-white dark:text-neutral-950"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Competitor Grid */}
      {filteredCompetitors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCompetitors.map((competitor) => (
            <div
              key={competitor.id}
              className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 flex flex-col gap-4"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between">
                <div className="space-y-1.5 min-w-0">
                  <h3 className="text-base font-semibold text-neutral-950 dark:text-neutral-50 truncate">
                    {competitor.name}
                  </h3>
                  {competitor.website && (
                    <a
                      href={
                        competitor.website.startsWith("http")
                          ? competitor.website
                          : `https://${competitor.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors truncate"
                    >
                      <GlobeIcon size={14} />
                      <span className="truncate">{competitor.website}</span>
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={
                      categoryBadgeVariant[competitor.category || "direct"] ||
                      "neutral"
                    }
                  >
                    {competitor.category || "direct"}
                  </Badge>
                  <ActionMenu
                    items={[
                      {
                        label: "View Details",
                        icon: <EyeIcon size={18} />,
                        href: `/dashboard/competitors/${competitor.id}`,
                      },
                      {
                        label: "Edit",
                        icon: <PencilSimpleIcon size={18} />,
                        onClick: () => openEditModal(competitor),
                      },
                      {
                        label: "AI Battle Card",
                        icon: <SparkleIcon size={18} />,
                        onClick: () => {
                          setSelectedCompetitorForAI(competitor.id);
                          setSelectedCompetitorName(competitor.name);
                          setAIBattleCardOpen(true);
                        },
                      },
                      {
                        label: "AI SWOT Analysis",
                        icon: <SparkleIcon size={18} />,
                        onClick: () => {
                          setSelectedCompetitorForAI(competitor.id);
                          setSelectedCompetitorName(competitor.name);
                          setAISwotOpen(true);
                        },
                      },
                      {
                        label: "Delete",
                        icon: <TrashIcon size={18} />,
                        onClick: () => handleDelete(competitor.id),
                        variant: "danger",
                      },
                    ]}
                  />
                </div>
              </div>

              {/* Strengths */}
              {competitor.strengths && competitor.strengths.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">
                    Strengths
                  </p>
                  <ul className="space-y-1">
                    {competitor.strengths.slice(0, 3).map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                        <span className="text-neutral-600 dark:text-neutral-300">
                          {s}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Weaknesses */}
              {competitor.weaknesses && competitor.weaknesses.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">
                    Weaknesses
                  </p>
                  <ul className="space-y-1">
                    {competitor.weaknesses.slice(0, 3).map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                        <span className="text-neutral-600 dark:text-neutral-300">
                          {w}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Card Footer */}
              <div className="mt-auto pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <Link
                  href={`/dashboard/competitors/${competitor.id}`}
                  className="text-sm font-medium text-neutral-950 dark:text-neutral-50 hover:underline"
                >
                  View Battle Card &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
          <EmptyState
            icon={<ShieldIcon size={24} />}
            title={
              activeTab !== "all"
                ? "No competitors in this category"
                : "No competitors yet"
            }
            description="Track your competitors and build battle cards to help your sales team win more deals."
            actions={[
              {
                label: "Add Competitor",
                icon: <PlusIcon size={18} weight="bold" />,
                variant: "primary",
                onClick: openCreateModal,
              },
            ]}
          />
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={closeModal}>
        <div className="p-6 space-y-5">
          {/* Modal Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
              {editingCompetitor ? "Edit Competitor" : "Add Competitor"}
            </h2>
            <button
              onClick={closeModal}
              className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <XIcon
                size={20}
                className="text-neutral-500 dark:text-neutral-400"
              />
            </button>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <Input
              label="Name"
              required
              placeholder="Competitor name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />

            <Input
              label="Website"
              placeholder="www.example.com"
              value={formWebsite}
              onChange={(e) => setFormWebsite(e.target.value)}
            />

            <Select
              label="Category"
              required
              options={categoryOptions}
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
            />

            <Textarea
              label="Description"
              placeholder="Brief description of this competitor..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              rows={3}
            />

            {/* Strengths tag input */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-neutral-950 dark:text-neutral-50">
                Strengths
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formStrengths.map((tag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full border border-green-200 dark:border-green-400/30 bg-green-100 dark:bg-green-400/15 text-green-600 dark:text-green-400 px-2.5 py-1 text-xs font-medium"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeStrength(i)}
                      className="hover:text-green-800 dark:hover:text-green-200"
                    >
                      <XIcon size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add strength and press Enter"
                  value={strengthInput}
                  onChange={(e) => setStrengthInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addStrength();
                    }
                  }}
                />
                <Button
                  variant="outline"
                  onClick={addStrength}
                  className="shrink-0"
                >
                  Add
                </Button>
              </div>
            </div>

            {/* Weaknesses tag input */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-neutral-950 dark:text-neutral-50">
                Weaknesses
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formWeaknesses.map((tag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full border border-red-200 dark:border-red-400/30 bg-red-100 dark:bg-red-400/15 text-red-600 dark:text-red-400 px-2.5 py-1 text-xs font-medium"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeWeakness(i)}
                      className="hover:text-red-800 dark:hover:text-red-200"
                    >
                      <XIcon size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add weakness and press Enter"
                  value={weaknessInput}
                  onChange={(e) => setWeaknessInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addWeakness();
                    }
                  }}
                />
                <Button
                  variant="outline"
                  onClick={addWeakness}
                  className="shrink-0"
                >
                  Add
                </Button>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending
                ? "Saving..."
                : editingCompetitor
                  ? "Update Competitor"
                  : "Create Competitor"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* AI Battle Card Modal */}
      <AIGenerateModal
        isOpen={aiBattleCardOpen}
        onClose={() => {
          setAIBattleCardOpen(false);
          setSelectedCompetitorForAI(null);
        }}
        title="AI Battle Card"
        description={`Generate battle card for ${selectedCompetitorName}`}
        onGenerate={async () => {
          if (!selectedCompetitorForAI) throw new Error("No competitor selected");
          const result = await aiGenerateBattleCard(selectedCompetitorForAI);
          if ("error" in result) throw new Error(result.error);
          return JSON.stringify(result, null, 2);
        }}
        editable={false}
      />

      {/* AI SWOT Analysis Modal */}
      <AIGenerateModal
        isOpen={aiSwotOpen}
        onClose={() => {
          setAISwotOpen(false);
          setSelectedCompetitorForAI(null);
        }}
        title="AI SWOT Analysis"
        description={`Analyze ${selectedCompetitorName}`}
        onGenerate={async () => {
          if (!selectedCompetitorForAI) throw new Error("No competitor selected");
          const result = await aiAnalyzeCompetitor(selectedCompetitorForAI);
          if ("error" in result) throw new Error(result.error);
          return JSON.stringify(result, null, 2);
        }}
        editable={false}
      />
    </div>
  );
}
