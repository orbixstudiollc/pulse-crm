"use client";

import { useState, useRef, useTransition } from "react";
import {
  Modal,
  Button,
  Select,
  Badge,
  UploadIcon,
  CheckCircleIcon,
  WarningIcon,
  XIcon,
  CircleNotchIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  FileTextIcon,
  DownloadIcon,
  SparkleIcon,
  BrainIcon,
  PaperPlaneTiltIcon,
} from "@/components/ui";
import { parseCSVPreview, importLeads } from "@/lib/actions/import";
import { aiMapCSVFields, processImportedLeadsStep } from "@/lib/actions/ai-import";
import { getSequences, enrollLeadsBulk } from "@/lib/actions/sequences";
import { toast } from "sonner";

interface ImportLeadsModalProps {
  open: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

type ImportStep = "upload" | "mapping" | "preview" | "importing" | "ai_processing" | "done";

const LEAD_FIELD_OPTIONS = [
  { label: "— Skip this column —", value: "__skip__" },
  // Basic Info
  { label: "Name", value: "name" },
  { label: "Email", value: "email" },
  { label: "Company", value: "company" },
  { label: "Phone", value: "phone" },
  { label: "Title / Role", value: "title" },
  { label: "Status (hot/warm/cold)", value: "status" },
  { label: "Source", value: "source" },
  // Company Info
  { label: "Industry", value: "industry" },
  { label: "Employees", value: "employees" },
  { label: "Website", value: "website" },
  { label: "Estimated Value", value: "estimated_value" },
  { label: "Location", value: "location" },
  { label: "Revenue Range", value: "revenue_range" },
  { label: "Tech Stack", value: "tech_stack" },
  { label: "Funding Stage", value: "funding_stage" },
  // Social
  { label: "LinkedIn URL", value: "linkedin" },
  { label: "Twitter / X", value: "twitter" },
  { label: "Facebook", value: "facebook" },
  { label: "Instagram", value: "instagram" },
  // Sales Intel
  { label: "Pain Points", value: "pain_points" },
  { label: "Trigger Event", value: "trigger_event" },
  { label: "Decision Role", value: "decision_role" },
  { label: "Current Solution", value: "current_solution" },
  { label: "Referred By", value: "referred_by" },
  // Personalization
  { label: "Personal Note", value: "personal_note" },
  { label: "Timezone", value: "timezone" },
  { label: "Preferred Language", value: "preferred_language" },
  { label: "Meeting Preference", value: "meeting_preference" },
  { label: "Tags", value: "tags" },
  { label: "Birthday", value: "birthday" },
  { label: "Content Interests", value: "content_interests" },
  // Assistant
  { label: "Assistant Name", value: "assistant_name" },
  { label: "Assistant Email", value: "assistant_email" },
];

function autoMapField(header: string): string {
  const h = header.toLowerCase().trim();
  const mappings: Record<string, string> = {
    name: "name",
    "full name": "name",
    "lead name": "name",
    "contact name": "name",
    "first name": "name",
    "last name": "name",
    email: "email",
    "email address": "email",
    "e-mail": "email",
    company: "company",
    "company name": "company",
    organization: "company",
    phone: "phone",
    "phone number": "phone",
    telephone: "phone",
    mobile: "phone",
    title: "title",
    "job title": "title",
    role: "title",
    position: "title",
    status: "status",
    "lead status": "status",
    source: "source",
    "lead source": "source",
    industry: "industry",
    sector: "industry",
    vertical: "industry",
    employees: "employees",
    "employee count": "employees",
    "company size": "employees",
    website: "website",
    url: "website",
    "web site": "website",
    value: "estimated_value",
    "estimated value": "estimated_value",
    "deal value": "estimated_value",
    revenue: "estimated_value",
    location: "location",
    city: "location",
    address: "location",
    linkedin: "linkedin",
    "linkedin url": "linkedin",
    "linkedin profile": "linkedin",
    twitter: "twitter",
    "twitter url": "twitter",
    facebook: "facebook",
    instagram: "instagram",
    "pain points": "pain_points",
    "pain_points": "pain_points",
    "trigger event": "trigger_event",
    "trigger_event": "trigger_event",
    timezone: "timezone",
    "time zone": "timezone",
    language: "preferred_language",
    "preferred language": "preferred_language",
    tags: "tags",
    "revenue range": "revenue_range",
    "revenue_range": "revenue_range",
    "tech stack": "tech_stack",
    "tech_stack": "tech_stack",
    "funding stage": "funding_stage",
    "funding_stage": "funding_stage",
    "decision role": "decision_role",
    "decision_role": "decision_role",
    "current solution": "current_solution",
    "current_solution": "current_solution",
    "referred by": "referred_by",
    "referred_by": "referred_by",
    "personal note": "personal_note",
    "personal_note": "personal_note",
    notes: "personal_note",
    birthday: "birthday",
    "content interests": "content_interests",
    "content_interests": "content_interests",
    "meeting preference": "meeting_preference",
    "meeting_preference": "meeting_preference",
    "assistant name": "assistant_name",
    "assistant_name": "assistant_name",
    "assistant email": "assistant_email",
    "assistant_email": "assistant_email",
  };
  return mappings[h] || "__skip__";
}

interface AIProcessingState {
  currentStep: "enrich" | "score" | "qualify" | "match" | "complete";
  enriched: number;
  scored: number;
  qualified: number;
  matched: number;
  errors: string[];
}

export function ImportLeadsModal({
  open,
  onClose,
  onImportComplete,
}: ImportLeadsModalProps) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [csvContent, setCsvContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<string[][]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<{
    imported: number;
    importedIds: string[];
    errors: string[];
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isAiMapping, setIsAiMapping] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [aiProcessing, setAiProcessing] = useState<AIProcessingState | null>(null);
  const [showSequenceEnroll, setShowSequenceEnroll] = useState(false);
  const [sequences, setSequences] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [selectedSequenceId, setSelectedSequenceId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStep("upload");
    setCsvContent("");
    setFileName("");
    setHeaders([]);
    setPreview([]);
    setTotalRows(0);
    setFieldMapping({});
    setImportResult(null);
    setIsAiMapping(false);
    setAiProcessing(null);
  };

  const handleSequenceEnroll = async () => {
    if (!selectedSequenceId || !importResult?.importedIds.length) return;
    setEnrolling(true);
    const result = await enrollLeadsBulk(selectedSequenceId, importResult.importedIds);
    if (result.enrolled > 0) {
      toast.success(`${result.enrolled} leads enrolled in sequence`);
    } else {
      toast.info("All leads are already enrolled in this sequence");
    }
    setEnrolling(false);
    setShowSequenceEnroll(false);
  };

  const handleClose = () => {
    resetState();
    setShowSequenceEnroll(false);
    setSelectedSequenceId(null);
    setSequences([]);
    onClose();
  };

  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      toast.error("Please upload a CSV file");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error("File too large. Maximum 25MB.");
      return;
    }

    const text = await file.text();
    setCsvContent(text);
    setFileName(file.name);

    startTransition(async () => {
      const result = await parseCSVPreview(text);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.data) {
        setHeaders(result.data.headers);
        setPreview(result.data.preview);
        setTotalRows(result.data.totalRows);

        // Auto-map fields using hardcoded dictionary
        const autoMapping: Record<string, string> = {};
        for (const header of result.data.headers) {
          autoMapping[header] = autoMapField(header);
        }
        setFieldMapping(autoMapping);
        setStep("mapping");
      }
    });
  };

  const handleAIMapFields = async () => {
    setIsAiMapping(true);
    try {
      const result = await aiMapCSVFields(headers, preview);
      if ("mapping" in result) {
        // Only apply AI mappings for valid field values
        const validValues = LEAD_FIELD_OPTIONS.map((o) => o.value);
        const newMapping: Record<string, string> = {};
        for (const [csvCol, field] of Object.entries(result.mapping)) {
          newMapping[csvCol] = validValues.includes(field) ? field : "__skip__";
        }
        setFieldMapping(newMapping);
        toast.success("AI mapped fields successfully!");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("AI field mapping failed. Using manual mapping.");
    } finally {
      setIsAiMapping(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleMappingChange = (csvColumn: string, leadField: string) => {
    setFieldMapping((prev) => ({ ...prev, [csvColumn]: leadField }));
  };

  const getMappedFieldCount = () => {
    return Object.values(fieldMapping).filter((v) => v !== "__skip__").length;
  };

  const hasRequiredField = () => {
    const mapped = Object.values(fieldMapping);
    return mapped.includes("name") || mapped.includes("email");
  };

  const handleStartImport = () => {
    if (!hasRequiredField()) {
      toast.error("You must map at least Name or Email");
      return;
    }

    setStep("importing");

    // Filter out skipped fields
    const cleanMapping: Record<string, string> = {};
    for (const [csv, field] of Object.entries(fieldMapping)) {
      if (field !== "__skip__") {
        cleanMapping[csv] = field;
      }
    }

    startTransition(async () => {
      const result = await importLeads(csvContent, cleanMapping);
      if (result.error && !result.data) {
        toast.error(result.error);
        setStep("mapping");
        return;
      }

      const data = result.data || { imported: 0, importedIds: [], errors: [] };
      setImportResult({
        imported: data.imported,
        importedIds: data.importedIds || [],
        errors: data.errors,
      });

      // If we have imported leads, start AI processing
      if (data.importedIds && data.importedIds.length > 0) {
        setStep("ai_processing");
        await runAIProcessing(data.importedIds);
      } else {
        setStep("done");
      }
    });
  };

  const runAIProcessing = async (leadIds: string[]) => {
    const state: AIProcessingState = {
      currentStep: "enrich",
      enriched: 0,
      scored: 0,
      qualified: 0,
      matched: 0,
      errors: [],
    };
    setAiProcessing({ ...state });

    // Step 1: Enrich
    try {
      state.currentStep = "enrich";
      setAiProcessing({ ...state });
      const enrichResult = await processImportedLeadsStep(leadIds, "enrich");
      state.enriched = enrichResult.processed;
      state.errors.push(...enrichResult.errors);
    } catch {
      state.errors.push("Enrichment step failed");
    }

    // Step 2: Score
    try {
      state.currentStep = "score";
      setAiProcessing({ ...state });
      const scoreResult = await processImportedLeadsStep(leadIds, "score");
      state.scored = scoreResult.processed;
      state.errors.push(...scoreResult.errors);
    } catch {
      state.errors.push("Scoring step failed");
    }

    // Step 3: Qualify
    try {
      state.currentStep = "qualify";
      setAiProcessing({ ...state });
      const qualResult = await processImportedLeadsStep(leadIds, "qualify");
      state.qualified = qualResult.processed;
      state.errors.push(...qualResult.errors);
    } catch {
      state.errors.push("Qualification step failed");
    }

    // Step 4: ICP Match
    try {
      state.currentStep = "match";
      setAiProcessing({ ...state });
      const matchResult = await processImportedLeadsStep(leadIds, "match");
      state.matched = matchResult.processed;
      state.errors.push(...matchResult.errors);
    } catch {
      // ICP match is optional
    }

    state.currentStep = "complete";
    setAiProcessing({ ...state });
    setStep("done");
  };

  const handleDownloadTemplate = () => {
    const templateHeaders = [
      "Name", "Email", "Company", "Phone", "Title", "Status", "Source",
      "Industry", "Employees", "Website", "Estimated Value", "Location",
      "LinkedIn", "Twitter", "Pain Points", "Trigger Event", "Revenue Range",
      "Tech Stack", "Funding Stage", "Decision Role", "Current Solution",
      "Referred By", "Tags", "Timezone", "Meeting Preference",
    ];
    const sampleRow1 = [
      "John Doe", "john@example.com", "Acme Corp", "+1234567890", "VP of Sales",
      "warm", "Website", "Technology", "50", "https://acme.com", "5000",
      "New York", "https://linkedin.com/in/johndoe", "@johndoe",
      "Manual reporting", "Series B funding", "$10M-$50M",
      "Salesforce, HubSpot", "series-b", "decision-maker", "HubSpot",
      "Jane Smith", "saas, automation", "America/New_York", "video",
    ];
    const sampleRow2 = [
      "Jane Smith", "jane@example.com", "Globex Inc", "+0987654321", "Head of Marketing",
      "hot", "Referral", "Finance", "200", "https://globex.com", "15000",
      "London", "https://linkedin.com/in/janesmith", "@janesmith",
      "Lead qualification", "New CMO hired", "$50M-$100M",
      "Marketo, Pardot", "series-c", "influencer", "Marketo",
      "Bob Johnson", "marketing, analytics", "Europe/London", "phone",
    ];
    const templateCSV = [
      templateHeaders.join(","),
      sampleRow1.map((v) => `"${v}"`).join(","),
      sampleRow2.map((v) => `"${v}"`).join(","),
    ].join("\n");
    const blob = new Blob([templateCSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Template downloaded!");
  };

  const aiStepLabels: Record<string, string> = {
    enrich: "Enriching lead data...",
    score: "Scoring leads...",
    qualify: "Qualifying leads (BANT + MEDDIC)...",
    match: "Matching ICP profiles...",
    complete: "AI processing complete!",
  };

  return (
    <Modal open={open} onClose={handleClose} className="max-w-2xl">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
              Import Leads
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              {step === "upload" && "Upload a CSV file to import leads"}
              {step === "mapping" && "Map CSV columns to lead fields"}
              {step === "preview" && "Review data before importing"}
              {step === "importing" && "Importing your leads..."}
              {step === "ai_processing" && "AI is processing your leads..."}
              {step === "done" && "Import complete"}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <XIcon size={20} className="text-neutral-400" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-6">
          {["Upload", "Map Fields", "Import", "AI Process"].map((label, i) => {
            const stepIndex =
              step === "upload"
                ? 0
                : step === "mapping" || step === "preview"
                  ? 1
                  : step === "importing"
                    ? 2
                    : 3;
            return (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                    i < stepIndex
                      ? "bg-emerald-500 text-white"
                      : i === stepIndex
                        ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400"
                  }`}
                >
                  {i < stepIndex ? (
                    <CheckCircleIcon size={16} weight="fill" />
                  ) : i === 3 ? (
                    <BrainIcon size={14} />
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-xs font-medium ${
                    i <= stepIndex
                      ? "text-neutral-950 dark:text-neutral-50"
                      : "text-neutral-400"
                  }`}
                >
                  {label}
                </span>
                {i < 3 && (
                  <div className="w-6 h-px bg-neutral-200 dark:bg-neutral-700" />
                )}
              </div>
            );
          })}
        </div>

        {/* Upload Step */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                dragActive
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                  : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                  <UploadIcon
                    size={24}
                    className="text-neutral-400 dark:text-neutral-500"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                    {isPending
                      ? "Processing..."
                      : "Drop your CSV file here, or click to browse"}
                  </p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                    CSV files up to 25MB
                  </p>
                </div>
              </div>
            </div>

            {/* Template Download */}
            <div className="flex items-center justify-between p-3 rounded bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <FileTextIcon
                  size={18}
                  className="text-neutral-400 dark:text-neutral-500"
                />
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  Need a template?
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadTemplate();
                }}
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <DownloadIcon size={14} />
                Download CSV Template
              </button>
            </div>
          </div>
        )}

        {/* Mapping Step */}
        {step === "mapping" && (
          <div className="space-y-4">
            {/* File info + AI Map button */}
            <div className="flex items-center justify-between p-3 rounded bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <FileTextIcon size={18} className="text-neutral-500" />
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {fileName}
                </span>
                <Badge variant="blue">{totalRows} rows</Badge>
              </div>
              <button
                onClick={handleAIMapFields}
                disabled={isAiMapping}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 text-white text-xs font-medium hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 transition-all"
              >
                {isAiMapping ? (
                  <CircleNotchIcon size={14} className="animate-spin" />
                ) : (
                  <SparkleIcon size={14} />
                )}
                {isAiMapping ? "AI Mapping..." : "AI Map Fields"}
              </button>
            </div>

            {/* Mapping Fields */}
            <div className="max-h-[320px] overflow-y-auto pr-1 space-y-3">
              {headers.map((header) => (
                <div
                  key={header}
                  className="flex items-center gap-3 p-3 rounded bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50 truncate">
                      {header}
                    </p>
                    <p className="text-xs text-neutral-400 mt-0.5 truncate">
                      e.g. {preview[0]?.[headers.indexOf(header)] || "—"}
                    </p>
                  </div>
                  <ArrowRightIcon
                    size={16}
                    className="text-neutral-300 dark:text-neutral-600 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <Select
                      options={LEAD_FIELD_OPTIONS}
                      value={fieldMapping[header] || "__skip__"}
                      onChange={(e) =>
                        handleMappingChange(header, e.target.value)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Mapping summary */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">
                {getMappedFieldCount()} of {headers.length} columns mapped
              </span>
              {!hasRequiredField() && (
                <span className="text-red-500 flex items-center gap-1">
                  <WarningIcon size={14} />
                  Map Name or Email
                </span>
              )}
            </div>

            {/* Preview Table */}
            {preview.length > 0 && (
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-2">
                  Preview (first {Math.min(preview.length, 3)} rows)
                </p>
                <div className="overflow-x-auto rounded border border-neutral-100 dark:border-neutral-800">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
                        {headers.map((h) => {
                          const mapped = fieldMapping[h];
                          return (
                            <th
                              key={h}
                              className="px-3 py-2 text-left font-medium text-neutral-500 whitespace-nowrap"
                            >
                              {mapped && mapped !== "__skip__" ? (
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  {
                                    LEAD_FIELD_OPTIONS.find(
                                      (o) => o.value === mapped
                                    )?.label
                                  }
                                </span>
                              ) : (
                                <span className="text-neutral-300 dark:text-neutral-600 line-through">
                                  {h}
                                </span>
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 3).map((row, ri) => (
                        <tr
                          key={ri}
                          className="border-b border-neutral-50 dark:border-neutral-800/50 last:border-0"
                        >
                          {row.map((cell, ci) => {
                            const mapped = fieldMapping[headers[ci]];
                            return (
                              <td
                                key={ci}
                                className={`px-3 py-1.5 whitespace-nowrap ${
                                  mapped && mapped !== "__skip__"
                                    ? "text-neutral-700 dark:text-neutral-300"
                                    : "text-neutral-300 dark:text-neutral-600"
                                }`}
                              >
                                {cell || "—"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                leftIcon={<ArrowLeftIcon size={16} />}
                onClick={resetState}
              >
                Back
              </Button>
              <Button
                onClick={handleStartImport}
                disabled={!hasRequiredField() || isPending}
                leftIcon={
                  isPending ? (
                    <CircleNotchIcon size={16} className="animate-spin" />
                  ) : (
                    <UploadIcon size={16} />
                  )
                }
              >
                Import {totalRows} Lead{totalRows !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}

        {/* Importing Step */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <CircleNotchIcon
              size={40}
              className="text-blue-500 animate-spin"
            />
            <div className="text-center">
              <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                Importing leads...
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                This may take a moment for large files.
              </p>
            </div>
          </div>
        )}

        {/* AI Processing Step */}
        {step === "ai_processing" && aiProcessing && (
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center">
                <BrainIcon
                  size={28}
                  className="text-violet-500 animate-pulse"
                />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
                  AI Processing Imported Leads
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  {importResult?.imported} leads being analyzed...
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {(["enrich", "score", "qualify", "match"] as const).map((s) => {
                const isActive = aiProcessing.currentStep === s;
                const isDone =
                  (s === "enrich" && ["score", "qualify", "match", "complete"].includes(aiProcessing.currentStep)) ||
                  (s === "score" && ["qualify", "match", "complete"].includes(aiProcessing.currentStep)) ||
                  (s === "qualify" && ["match", "complete"].includes(aiProcessing.currentStep)) ||
                  (s === "match" && aiProcessing.currentStep === "complete");
                const count =
                  s === "enrich" ? aiProcessing.enriched :
                  s === "score" ? aiProcessing.scored :
                  s === "qualify" ? aiProcessing.qualified :
                  aiProcessing.matched;

                return (
                  <div
                    key={s}
                    className={`flex items-center gap-3 p-3 rounded border transition-colors ${
                      isActive
                        ? "border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20"
                        : isDone
                          ? "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20"
                          : "border-neutral-100 dark:border-neutral-800 opacity-50"
                    }`}
                  >
                    <div className="w-6 h-6 flex items-center justify-center">
                      {isActive ? (
                        <CircleNotchIcon size={18} className="text-violet-500 animate-spin" />
                      ) : isDone ? (
                        <CheckCircleIcon size={18} weight="fill" className="text-emerald-500" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-neutral-200 dark:border-neutral-700" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                        {aiStepLabels[s]}
                      </p>
                    </div>
                    {isDone && (
                      <Badge variant="green">{count} done</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Done Step */}
        {step === "done" && importResult && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-6 gap-3">
              <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                <CheckCircleIcon
                  size={32}
                  weight="fill"
                  className="text-emerald-500"
                />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
                  {importResult.imported} Lead
                  {importResult.imported !== 1 ? "s" : ""} Imported
                </p>
                {importResult.errors.length > 0 && (
                  <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                    {importResult.errors.length} row
                    {importResult.errors.length !== 1 ? "s" : ""} had issues
                  </p>
                )}
              </div>
            </div>

            {/* AI Processing Summary */}
            {aiProcessing && aiProcessing.currentStep === "complete" && (
              <div className="rounded border border-violet-200 dark:border-violet-800/50 bg-violet-50/50 dark:bg-violet-950/20 p-4 space-y-2">
                <p className="text-sm font-medium text-violet-900 dark:text-violet-200 flex items-center gap-1.5">
                  <BrainIcon size={16} /> AI Processing Summary
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-xs text-violet-700 dark:text-violet-300">
                    Enriched: <span className="font-semibold">{aiProcessing.enriched}</span> leads
                  </div>
                  <div className="text-xs text-violet-700 dark:text-violet-300">
                    Scored: <span className="font-semibold">{aiProcessing.scored}</span> leads
                  </div>
                  <div className="text-xs text-violet-700 dark:text-violet-300">
                    Qualified: <span className="font-semibold">{aiProcessing.qualified}</span> leads
                  </div>
                  <div className="text-xs text-violet-700 dark:text-violet-300">
                    ICP Matched: <span className="font-semibold">{aiProcessing.matched}</span> leads
                  </div>
                </div>
              </div>
            )}

            {/* Add to Sequence */}
            {importResult.importedIds.length > 0 && !showSequenceEnroll && (
              <button
                onClick={async () => {
                  setShowSequenceEnroll(true);
                  const res = await getSequences();
                  setSequences((res.data ?? []).map((s) => ({ id: s.id, name: s.name, status: s.status })));
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <PaperPlaneTiltIcon size={16} />
                Add to Sequence
              </button>
            )}

            {showSequenceEnroll && (
              <div className="rounded border border-neutral-200 dark:border-neutral-700 p-3 space-y-3">
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">Enroll in Sequence</p>
                <select
                  value={selectedSequenceId ?? ""}
                  onChange={(e) => setSelectedSequenceId(e.target.value || null)}
                  className="w-full px-3 py-2 text-sm rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-950 dark:text-neutral-50"
                >
                  <option value="">Select a sequence...</option>
                  {sequences.filter((s) => s.status === "active").map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSequenceEnroll(false)}
                    className="flex-1 px-3 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 rounded hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSequenceEnroll}
                    disabled={!selectedSequenceId || enrolling}
                    className="flex-1 px-3 py-1.5 text-xs font-medium bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 rounded hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-50"
                  >
                    {enrolling ? "Enrolling..." : `Enroll ${importResult.importedIds.length} Leads`}
                  </button>
                </div>
              </div>
            )}

            {/* Errors list */}
            {importResult.errors.length > 0 && (
              <div className="max-h-[120px] overflow-y-auto rounded border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-1">
                {importResult.errors.slice(0, 20).map((err, i) => (
                  <p
                    key={i}
                    className="text-xs text-amber-700 dark:text-amber-300"
                  >
                    {err}
                  </p>
                ))}
                {importResult.errors.length > 20 && (
                  <p className="text-xs text-amber-500 mt-1">
                    ...and {importResult.errors.length - 20} more
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => {
                  handleClose();
                  onImportComplete?.();
                }}
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
