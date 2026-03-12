"use client";

import { useState, useTransition } from "react";
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
  PencilSimpleIcon,
  TrashIcon,
  XIcon,
  SparkleIcon,
} from "@/components/ui";
import {
  PageHeader,
  StatCard,
  EmptyState,
} from "@/components/dashboard";
import { AIActionButton, AIGenerateModal } from "@/components/features";
import {
  createObjection,
  updateObjection,
  deleteObjection,
} from "@/lib/actions/objections";
import { aiGenerateResponse } from "@/lib/actions/ai-objections";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface ObjectionRecord {
  id: string;
  category: string;
  objection_text: string;
  hidden_meaning: string | null;
  ffr_response: string | null;
  abc_response: string | null;
  follow_up_question: string | null;
  proof_point: string | null;
  walk_away_criteria: string | null;
  created_at: string;
  [key: string]: unknown;
}

// ── Config ───────────────────────────────────────────────────────────────────

const categoryConfig: Record<
  string,
  { label: string; variant: "neutral" | "green" | "amber" | "red" }
> = {
  pricing: { label: "Pricing", variant: "green" },
  competition: { label: "Competition", variant: "amber" },
  timing: { label: "Timing", variant: "neutral" },
  authority: { label: "Authority", variant: "red" },
  need: { label: "Need", variant: "amber" },
  implementation: { label: "Implementation", variant: "neutral" },
};

const categoryTabs = [
  { label: "All", value: "all" },
  { label: "Pricing", value: "pricing" },
  { label: "Competition", value: "competition" },
  { label: "Timing", value: "timing" },
  { label: "Authority", value: "authority" },
  { label: "Need", value: "need" },
  { label: "Implementation", value: "implementation" },
];

const categoryOptions = [
  { label: "Pricing", value: "pricing" },
  { label: "Competition", value: "competition" },
  { label: "Timing", value: "timing" },
  { label: "Authority", value: "authority" },
  { label: "Need", value: "need" },
  { label: "Implementation", value: "implementation" },
];

// ── Component ────────────────────────────────────────────────────────────────

export function PlaybookPageClient({
  initialObjections,
}: {
  initialObjections: ObjectionRecord[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [editingObjection, setEditingObjection] =
    useState<ObjectionRecord | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // AI state
  const [aiResponseOpen, setAIResponseOpen] = useState(false);
  const [selectedObjectionForAI, setSelectedObjectionForAI] = useState<string | null>(null);
  const [selectedObjectionTitle, setSelectedObjectionTitle] = useState<string>("");

  // Form state
  const [formCategory, setFormCategory] = useState("pricing");
  const [formObjection, setFormObjection] = useState("");
  const [formHidden, setFormHidden] = useState("");
  const [formFFR, setFormFFR] = useState("");
  const [formABC, setFormABC] = useState("");
  const [formFollowUp, setFormFollowUp] = useState("");
  const [formProof, setFormProof] = useState("");
  const [formWalkAway, setFormWalkAway] = useState("");

  const objections = initialObjections;

  const filtered =
    activeTab === "all"
      ? objections
      : objections.filter((o) => o.category === activeTab);

  // Stats
  const totalObjections = objections.length;
  const categoryCounts = Object.keys(categoryConfig).reduce(
    (acc, cat) => {
      acc[cat] = objections.filter((o) => o.category === cat).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  const resetForm = () => {
    setFormCategory("pricing");
    setFormObjection("");
    setFormHidden("");
    setFormFFR("");
    setFormABC("");
    setFormFollowUp("");
    setFormProof("");
    setFormWalkAway("");
    setEditingObjection(null);
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (obj: ObjectionRecord) => {
    setEditingObjection(obj);
    setFormCategory(obj.category);
    setFormObjection(obj.objection_text);
    setFormHidden(obj.hidden_meaning || "");
    setFormFFR(obj.ffr_response || "");
    setFormABC(obj.abc_response || "");
    setFormFollowUp(obj.follow_up_question || "");
    setFormProof(obj.proof_point || "");
    setFormWalkAway(obj.walk_away_criteria || "");
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formObjection.trim()) {
      toast.error("Objection text is required");
      return;
    }

    startTransition(async () => {
      const payload = {
        category: formCategory,
        objection_text: formObjection.trim(),
        hidden_meaning: formHidden.trim() || undefined,
        ffr_response: formFFR.trim() || undefined,
        abc_response: formABC.trim() || undefined,
        follow_up_question: formFollowUp.trim() || undefined,
        proof_point: formProof.trim() || undefined,
        walk_away_criteria: formWalkAway.trim() || undefined,
      };

      const result = editingObjection
        ? await updateObjection(editingObjection.id, payload)
        : await createObjection(payload);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          editingObjection ? "Objection updated" : "Objection added",
        );
        setShowModal(false);
        resetForm();
        router.refresh();
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteObjection(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Objection deleted");
        router.refresh();
      }
    });
  };

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 space-y-4">
      {/* Header */}
      <PageHeader title="Objection Playbook">
        <Button
          leftIcon={<PlusIcon size={20} weight="bold" />}
          onClick={openCreate}
        >
          Add Objection
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Objections"
          value={totalObjections.toString()}
          icon={
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-neutral-950 dark:text-neutral-50"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          }
        />
        <StatCard
          label="Pricing"
          value={(categoryCounts.pricing || 0).toString()}
          icon={
            <div className="h-3 w-3 rounded-full bg-green-500" />
          }
        />
        <StatCard
          label="Competition"
          value={(categoryCounts.competition || 0).toString()}
          icon={
            <div className="h-3 w-3 rounded-full bg-amber-500" />
          }
        />
        <StatCard
          label="Authority"
          value={(categoryCounts.authority || 0).toString()}
          icon={
            <div className="h-3 w-3 rounded-full bg-red-500" />
          }
        />
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-1.5">
        {categoryTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors",
              activeTab === tab.value
                ? "bg-neutral-950 dark:bg-white text-white dark:text-neutral-950"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-800",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Objection Cards */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((obj) => {
            const cat =
              categoryConfig[obj.category] || categoryConfig.pricing;
            const isExpanded = expandedId === obj.id;

            return (
              <div
                key={obj.id}
                className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden"
              >
                {/* Header (always visible) */}
                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : obj.id)
                  }
                  className="w-full flex items-start justify-between p-5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Badge variant={cat.variant} dot>
                        {cat.label}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                      &ldquo;{obj.objection_text}&rdquo;
                    </p>
                    {obj.hidden_meaning && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Hidden meaning: {obj.hidden_meaning}
                      </p>
                    )}
                  </div>
                  <div
                    className="flex items-center gap-2 ml-4 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ActionMenu
                      items={[
                        {
                          label: "Edit",
                          icon: <PencilSimpleIcon size={18} />,
                          onClick: () => openEdit(obj),
                        },
                        {
                          label: "AI Response",
                          icon: <SparkleIcon size={18} />,
                          onClick: () => {
                            setSelectedObjectionForAI(obj.id);
                            setSelectedObjectionTitle(obj.objection_text);
                            setAIResponseOpen(true);
                          },
                        },
                        {
                          label: "Delete",
                          icon: <TrashIcon size={18} />,
                          onClick: () => handleDelete(obj.id),
                          variant: "danger",
                        },
                      ]}
                    />
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-neutral-200 dark:border-neutral-800 p-5 space-y-4">
                    {/* FFR Response */}
                    {obj.ffr_response && (
                      <div>
                        <h4 className="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
                          Feel-Felt-Found Response
                        </h4>
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 bg-green-50 dark:bg-green-950/20 rounded-lg p-3 border border-green-100 dark:border-green-900/30">
                          {obj.ffr_response}
                        </p>
                      </div>
                    )}

                    {/* ABC Response */}
                    {obj.abc_response && (
                      <div>
                        <h4 className="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
                          Acknowledge-Bridge-Close Response
                        </h4>
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 border border-blue-100 dark:border-blue-900/30">
                          {obj.abc_response}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Follow-up Question */}
                      {obj.follow_up_question && (
                        <div>
                          <h4 className="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
                            Follow-Up Question
                          </h4>
                          <p className="text-sm text-neutral-700 dark:text-neutral-300">
                            {obj.follow_up_question}
                          </p>
                        </div>
                      )}

                      {/* Proof Point */}
                      {obj.proof_point && (
                        <div>
                          <h4 className="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
                            Proof Point
                          </h4>
                          <p className="text-sm text-neutral-700 dark:text-neutral-300">
                            {obj.proof_point}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Walk Away Criteria */}
                    {obj.walk_away_criteria && (
                      <div>
                        <h4 className="text-[10px] uppercase tracking-wider text-red-400 dark:text-red-500 mb-1.5">
                          Walk Away If...
                        </h4>
                        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 rounded-lg p-3 border border-red-100 dark:border-red-900/30">
                          {obj.walk_away_criteria}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
          <EmptyState
            icon={
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            }
            title={
              activeTab !== "all"
                ? "No objections in this category"
                : "No objections yet"
            }
            description={
              activeTab !== "all"
                ? "Try selecting a different category or add a new objection."
                : "Build your objection playbook with proven responses to common sales objections."
            }
            actions={[
              {
                label: "Add Objection",
                icon: <PlusIcon size={18} weight="bold" />,
                variant: "primary",
                onClick: openCreate,
              },
            ]}
          />
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-serif text-neutral-950 dark:text-neutral-50">
              {editingObjection ? "Edit Objection" : "Add Objection"}
            </h2>
            <button
              onClick={() => setShowModal(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <XIcon size={20} className="text-neutral-500" />
            </button>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <Select
              label="Category"
              required
              options={categoryOptions}
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
            />
            <Textarea
              label="Objection"
              required
              placeholder='e.g. "Your price is too high"'
              value={formObjection}
              onChange={(e) => setFormObjection(e.target.value)}
            />
            <Input
              label="Hidden Meaning"
              placeholder="What the prospect really means..."
              value={formHidden}
              onChange={(e) => setFormHidden(e.target.value)}
            />
            <Textarea
              label="Feel-Felt-Found (FFR) Response"
              placeholder="I understand how you feel. Others have felt the same way. What they found was..."
              value={formFFR}
              onChange={(e) => setFormFFR(e.target.value)}
            />
            <Textarea
              label="Acknowledge-Bridge-Close (ABC) Response"
              placeholder="I hear you. That said, consider this... So shall we..."
              value={formABC}
              onChange={(e) => setFormABC(e.target.value)}
            />
            <Input
              label="Follow-Up Question"
              placeholder="A question to redirect the conversation..."
              value={formFollowUp}
              onChange={(e) => setFormFollowUp(e.target.value)}
            />
            <Input
              label="Proof Point"
              placeholder="Evidence to support your response..."
              value={formProof}
              onChange={(e) => setFormProof(e.target.value)}
            />
            <Input
              label="Walk Away Criteria"
              placeholder="When to disengage..."
              value={formWalkAway}
              onChange={(e) => setFormWalkAway(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={isPending}
            >
              {isPending
                ? "Saving..."
                : editingObjection
                  ? "Update"
                  : "Add Objection"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* AI Objection Response Modal */}
      <AIGenerateModal
        isOpen={aiResponseOpen}
        onClose={() => {
          setAIResponseOpen(false);
          setSelectedObjectionForAI(null);
        }}
        title="AI Objection Response"
        description={`Generate response for: ${selectedObjectionTitle}`}
        onGenerate={async () => {
          if (!selectedObjectionForAI) throw new Error("No objection selected");
          const result = await aiGenerateResponse(selectedObjectionForAI);
          if ("error" in result) throw new Error(result.error);
          return typeof result === "string" ? result : JSON.stringify(result, null, 2);
        }}
        editable={true}
      />
    </div>
  );
}
