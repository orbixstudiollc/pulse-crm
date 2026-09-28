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
  { key: "budget" as const, label: "Budget", color: "bg-accent-strong", tagsField: "signals" as const, textField: "notes" as const, tagsLabel: "Signals", textLabel: "Notes" },
  { key: "authority" as const, label: "Authority", color: "bg-accent-strong", tagsField: "contacts" as const, textField: "decision_process" as const, tagsLabel: "Contacts", textLabel: "Decision Process" },
  { key: "need" as const, label: "Need", color: "bg-warning", tagsField: "pain_points" as const, textField: "severity" as const, tagsLabel: "Pain Points", textLabel: "Severity" },
  { key: "timeline" as const, label: "Timeline", color: "bg-success-fill", tagsField: "trigger_events" as const, textField: "urgency" as const, tagsLabel: "Trigger Events", textLabel: "Urgency" },
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
      [key]: { ...prev[key], [field]: [...(prev[key] as unknown as Record<string, string[]>)[field], input] },
    }));
    setTagInputs(prev => ({ ...prev, [`${key}-${field}`]: "" }));
  };

  const handleRemoveTag = (key: keyof BANTData, field: string, index: number) => {
    setFormData(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: (prev[key] as unknown as Record<string, string[]>)[field].filter((_: string, i: number) => i !== index) },
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
        <h3 className="text-heading-md text-fg">BANT Qualification</h3>
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving..." : "Save BANT"}
        </Button>
      </div>

      <div className="space-y-6">
        {sections.map((section) => {
          const sectionData = formData[section.key];
          const tags = (sectionData as unknown as Record<string, string[]>)[section.tagsField];
          const textValue = (sectionData as unknown as Record<string, string>)[section.textField];

          return (
            <div key={section.key} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn("h-2.5 w-2.5 rounded-full", section.color)} />
                  <span className="text-sm font-medium text-fg">{section.label}</span>
                </div>
                <span className="text-sm font-semibold text-fg">{sectionData.score}/25</span>
              </div>

              {/* Score Slider */}
              <input
                type="range"
                min={0}
                max={25}
                value={sectionData.score}
                onChange={(e) => handleScoreChange(section.key, parseInt(e.target.value))}
                className="w-full h-1.5 mb-4 rounded-full appearance-none cursor-pointer bg-active accent-accent"
              />

              {/* Tags */}
              <div className="mb-3">
                <label className="text-xs text-fg-secondary mb-1.5 block">{section.tagsLabel}</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tags.map((tag, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted text-fg">
                      {tag}
                      <button onClick={() => handleRemoveTag(section.key, section.tagsField, i)} className="hover:text-danger transition-colors">&times;</button>
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
                    className="flex-1 h-8 rounded-md border border-line bg-surface px-3 text-xs text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <button
                    onClick={() => handleAddTag(section.key, section.tagsField)}
                    className="h-8 px-3 rounded-md border border-line text-xs text-fg-secondary hover:bg-muted transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Text field */}
              <div>
                <label className="text-xs text-fg-secondary mb-1.5 block">{section.textLabel}</label>
                <textarea
                  value={textValue}
                  onChange={(e) => handleTextChange(section.key, section.textField, e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-line bg-surface px-3 py-2 text-xs text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
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
