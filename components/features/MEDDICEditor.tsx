"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { updateMEDDIC, type MEDDICData } from "@/lib/actions/qualification";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MEDDICEditorProps {
  leadId: string;
  data: MEDDICData;
}

export function MEDDICEditor({ leadId, data }: MEDDICEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState<MEDDICData>(data);
  const [criteriaInput, setCriteriaInput] = useState("");
  const [painInput, setPainInput] = useState("");

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateMEDDIC(leadId, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`MEDDIC saved — Grade: ${result.data?.grade}`);
        router.refresh();
      }
    });
  };

  const addCriteria = () => {
    if (!criteriaInput.trim()) return;
    setFormData(prev => ({
      ...prev,
      decision_criteria: { ...prev.decision_criteria, criteria: [...prev.decision_criteria.criteria, criteriaInput.trim()] },
    }));
    setCriteriaInput("");
  };

  const removeCriteria = (i: number) => {
    setFormData(prev => ({
      ...prev,
      decision_criteria: { ...prev.decision_criteria, criteria: prev.decision_criteria.criteria.filter((_, idx) => idx !== i) },
    }));
  };

  const addPain = () => {
    if (!painInput.trim()) return;
    setFormData(prev => ({
      ...prev,
      identify_pain: { ...prev.identify_pain, pains: [...prev.identify_pain.pains, painInput.trim()] },
    }));
    setPainInput("");
  };

  const removePain = (i: number) => {
    setFormData(prev => ({
      ...prev,
      identify_pain: { ...prev.identify_pain, pains: prev.identify_pain.pains.filter((_, idx) => idx !== i) },
    }));
  };

  const inputCls = "w-full h-8 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 text-xs text-neutral-950 dark:text-neutral-50 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-400";
  const labelCls = "text-xs text-neutral-500 dark:text-neutral-400 mb-1.5 block";
  const sectionCls = "rounded border border-neutral-200 dark:border-neutral-800 p-4";

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-medium text-neutral-950 dark:text-neutral-50">MEDDIC Qualification</h3>
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving..." : "Save MEDDIC"}
        </Button>
      </div>

      <div className="space-y-4">
        {/* Metrics */}
        <div className={sectionCls}>
          <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-3">Metrics</p>
          <div className="space-y-2">
            <div>
              <label className={labelCls}>Confidence</label>
              <div className="flex gap-2">
                {(["low", "medium", "high"] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setFormData(prev => ({ ...prev, metrics: { ...prev.metrics, confidence: prev.metrics.confidence === level ? "" : level } }))}
                    className={cn(
                      "px-3 py-1.5 rounded border text-xs font-medium transition-colors",
                      formData.metrics.confidence === level
                        ? level === "high" ? "border-green-500 bg-green-100 text-green-700 dark:bg-green-400/15 dark:text-green-400 dark:border-green-400/30"
                        : level === "medium" ? "border-amber-500 bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-400 dark:border-amber-400/30"
                        : "border-red-500 bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-400 dark:border-red-400/30"
                        : "border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800",
                    )}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Details</label>
              <input type="text" value={formData.metrics.details} onChange={(e) => setFormData(prev => ({ ...prev, metrics: { ...prev.metrics, details: e.target.value } }))} className={inputCls} placeholder="Key metrics and KPIs..." />
            </div>
          </div>
        </div>

        {/* Economic Buyer */}
        <div className={sectionCls}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">Economic Buyer</p>
            <button
              onClick={() => setFormData(prev => ({ ...prev, economic_buyer: { ...prev.economic_buyer, identified: !prev.economic_buyer.identified } }))}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                formData.economic_buyer.identified
                  ? "border-green-500 bg-green-100 text-green-700 dark:bg-green-400/15 dark:text-green-400 dark:border-green-400/30"
                  : "border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400",
              )}
            >
              {formData.economic_buyer.identified ? "Identified" : "Not Identified"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Name</label>
              <input type="text" value={formData.economic_buyer.name} onChange={(e) => setFormData(prev => ({ ...prev, economic_buyer: { ...prev.economic_buyer, name: e.target.value } }))} className={inputCls} placeholder="Name..." />
            </div>
            <div>
              <label className={labelCls}>Title</label>
              <input type="text" value={formData.economic_buyer.title} onChange={(e) => setFormData(prev => ({ ...prev, economic_buyer: { ...prev.economic_buyer, title: e.target.value } }))} className={inputCls} placeholder="Title..." />
            </div>
          </div>
        </div>

        {/* Decision Criteria */}
        <div className={sectionCls}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">Decision Criteria</p>
            <button
              onClick={() => setFormData(prev => ({ ...prev, decision_criteria: { ...prev.decision_criteria, ranked: !prev.decision_criteria.ranked } }))}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                formData.decision_criteria.ranked
                  ? "border-green-500 bg-green-100 text-green-700 dark:bg-green-400/15 dark:text-green-400 dark:border-green-400/30"
                  : "border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400",
              )}
            >
              {formData.decision_criteria.ranked ? "Ranked" : "Unranked"}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {formData.decision_criteria.criteria.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                {c}
                <button onClick={() => removeCriteria(i)} className="hover:text-red-500">&times;</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" value={criteriaInput} onChange={(e) => setCriteriaInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCriteria(); } }} className={cn(inputCls, "flex-1")} placeholder="Add criteria..." />
            <button onClick={addCriteria} className="h-8 px-3 rounded border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">Add</button>
          </div>
        </div>

        {/* Decision Process */}
        <div className={sectionCls}>
          <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-3">Decision Process</p>
          <div className="space-y-2">
            <div>
              <label className={labelCls}>Type</label>
              <div className="flex flex-wrap gap-2">
                {(["self-serve", "single", "committee", "procurement"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFormData(prev => ({ ...prev, decision_process: { ...prev.decision_process, type: prev.decision_process.type === type ? "" : type } }))}
                    className={cn(
                      "px-3 py-1.5 rounded border text-xs font-medium transition-colors",
                      formData.decision_process.type === type
                        ? "border-neutral-950 dark:border-neutral-50 bg-neutral-950 dark:bg-neutral-50 text-white dark:text-neutral-950"
                        : "border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800",
                    )}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1).replace("-", " ")}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Details</label>
              <input type="text" value={formData.decision_process.details} onChange={(e) => setFormData(prev => ({ ...prev, decision_process: { ...prev.decision_process, details: e.target.value } }))} className={inputCls} placeholder="Process details..." />
            </div>
          </div>
        </div>

        {/* Identify Pain */}
        <div className={sectionCls}>
          <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-3">Identify Pain</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {formData.identify_pain.pains.map((p, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                {p}
                <button onClick={() => removePain(i)} className="hover:text-red-500">&times;</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 mb-2">
            <input type="text" value={painInput} onChange={(e) => setPainInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPain(); } }} className={cn(inputCls, "flex-1")} placeholder="Add pain point..." />
            <button onClick={addPain} className="h-8 px-3 rounded border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">Add</button>
          </div>
          <div>
            <label className={labelCls}>Severity</label>
            <input type="text" value={formData.identify_pain.severity} onChange={(e) => setFormData(prev => ({ ...prev, identify_pain: { ...prev.identify_pain, severity: e.target.value } }))} className={inputCls} placeholder="Pain severity assessment..." />
          </div>
        </div>

        {/* Champion */}
        <div className={sectionCls}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">Champion</p>
            <button
              onClick={() => setFormData(prev => ({ ...prev, champion: { ...prev.champion, identified: !prev.champion.identified } }))}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                formData.champion.identified
                  ? "border-green-500 bg-green-100 text-green-700 dark:bg-green-400/15 dark:text-green-400 dark:border-green-400/30"
                  : "border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400",
              )}
            >
              {formData.champion.identified ? "Identified" : "Not Identified"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Name</label>
              <input type="text" value={formData.champion.name} onChange={(e) => setFormData(prev => ({ ...prev, champion: { ...prev.champion, name: e.target.value } }))} className={inputCls} placeholder="Name..." />
            </div>
            <div>
              <label className={labelCls}>Strength</label>
              <input type="text" value={formData.champion.strength} onChange={(e) => setFormData(prev => ({ ...prev, champion: { ...prev.champion, strength: e.target.value } }))} className={inputCls} placeholder="Champion strength..." />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
