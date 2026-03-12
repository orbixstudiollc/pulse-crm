"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { updateBANT, type BANTData } from "@/lib/actions/qualification";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BANTEditorProps {
  leadId: string;
  data: BANTData;
}

const sections = [
  { key: "budget" as const, label: "Budget", color: "bg-blue-500", tagsField: "signals" as const, textField: "notes" as const, tagsLabel: "Signals", textLabel: "Notes" },
  { key: "authority" as const, label: "Authority", color: "bg-violet-500", tagsField: "contacts" as const, textField: "decision_process" as const, tagsLabel: "Contacts", textLabel: "Decision Process" },
  { key: "need" as const, label: "Need", color: "bg-amber-500", tagsField: "pain_points" as const, textField: "severity" as const, tagsLabel: "Pain Points", textLabel: "Severity" },
  { key: "timeline" as const, label: "Timeline", color: "bg-green-500", tagsField: "trigger_events" as const, textField: "urgency" as const, tagsLabel: "Trigger Events", textLabel: "Urgency" },
];

export function BANTEditor({ leadId, data }: BANTEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState<BANTData>(data);
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});

  const handleScoreChange = (key: keyof BANTData, value: number) => {
    setFormData(prev => ({
      ...prev,
      [key]: { ...prev[key], score: value },
    }));
  };

  const handleTextChange = (key: keyof BANTData, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const handleAddTag = (key: keyof BANTData, field: string) => {
    const input = tagInputs[`${key}-${field}`]?.trim();
    if (!input) return;
    setFormData(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: [...(prev[key] as any)[field], input] },
    }));
    setTagInputs(prev => ({ ...prev, [`${key}-${field}`]: "" }));
  };

  const handleRemoveTag = (key: keyof BANTData, field: string, index: number) => {
    setFormData(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: (prev[key] as any)[field].filter((_: string, i: number) => i !== index) },
    }));
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateBANT(leadId, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`BANT saved — Grade: ${result.data?.grade}`);
        router.refresh();
      }
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-medium text-neutral-950 dark:text-neutral-50">BANT Qualification</h3>
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving..." : "Save BANT"}
        </Button>
      </div>

      <div className="space-y-6">
        {sections.map((section) => {
          const sectionData = formData[section.key];
          const tags = (sectionData as any)[section.tagsField] as string[];
          const textValue = (sectionData as any)[section.textField] as string;

          return (
            <div key={section.key} className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn("h-2.5 w-2.5 rounded-full", section.color)} />
                  <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">{section.label}</span>
                </div>
                <span className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">{sectionData.score}/25</span>
              </div>

              {/* Score Slider */}
              <input
                type="range"
                min={0}
                max={25}
                value={sectionData.score}
                onChange={(e) => handleScoreChange(section.key, parseInt(e.target.value))}
                className="w-full h-1.5 mb-4 rounded-full appearance-none cursor-pointer bg-neutral-200 dark:bg-neutral-800 accent-neutral-950 dark:accent-neutral-50"
              />

              {/* Tags */}
              <div className="mb-3">
                <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1.5 block">{section.tagsLabel}</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tags.map((tag, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                      {tag}
                      <button onClick={() => handleRemoveTag(section.key, section.tagsField, i)} className="hover:text-red-500 transition-colors">&times;</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInputs[`${section.key}-${section.tagsField}`] || ""}
                    onChange={(e) => setTagInputs(prev => ({ ...prev, [`${section.key}-${section.tagsField}`]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(section.key, section.tagsField); } }}
                    placeholder={`Add ${section.tagsLabel.toLowerCase()}...`}
                    className="flex-1 h-8 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 text-xs text-neutral-950 dark:text-neutral-50 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                  />
                  <button
                    onClick={() => handleAddTag(section.key, section.tagsField)}
                    className="h-8 px-3 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Text field */}
              <div>
                <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1.5 block">{section.textLabel}</label>
                <textarea
                  value={textValue}
                  onChange={(e) => handleTextChange(section.key, section.textField, e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-xs text-neutral-950 dark:text-neutral-50 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-400 resize-none"
                  placeholder={`Enter ${section.textLabel.toLowerCase()}...`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
