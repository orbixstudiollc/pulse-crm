"use client";

import { useState, useRef, useTransition, useEffect } from "react";
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
  PaperPlaneTiltIcon,
} from "@/components/ui";
import { importLeadRows } from "@/lib/actions/import";
import { aiMapCSVFields } from "@/lib/actions/ai-import";
import { createCsvParser, jsonStringBytes, readCsvPreview } from "@/lib/csv/stream-parser";
import { IMPORT_BATCH_ROWS, IMPORT_MAX_CELL_CHARS } from "@/lib/import/lead-rows";
import { getSequences, enrollLeadsBulk } from "@/lib/actions/sequences";
import { toast } from "sonner";

interface ImportLeadsModalProps {
  open: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

type ImportStep = "upload" | "mapping" | "preview" | "importing" | "done";

const MAX_FILE_BYTES = 1024 ** 3; // 1 GB
// Also flush early when a batch nears this many encoded bytes, to stay well under the request body cap.
const MAX_BATCH_BYTES = 3_000_000;
const OVERSIZED_CELL_ERROR = `a cell is longer than ${IMPORT_MAX_CELL_CHARS.toLocaleString("en-US")} characters, skipped`;
const MAX_ERROR_LINES = 200;
// Keep imported ids (for sequence enrollment) only up to this many leads.
const MAX_ENROLL_IDS = 10_000;
const GUEST_LIMIT_MESSAGE = "Guest workspaces can hold up to 1,000 leads. Sign up to import more.";

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

interface ImportOutcome {
  imported: number;
  /** null once the import passes MAX_ENROLL_IDS leads. */
  importedIds: string[] | null;
  errors: string[];
  errorCount: number;
  guestLimitReached: boolean;
  cancelled: boolean;
  failure: string | null;
}

interface StreamImportHooks {
  onProgress: (bytesRead: number, imported: number) => void;
  isCancelled: () => boolean;
}

type BatchResult = Awaited<ReturnType<typeof importLeadRows>>;

function addRowErrors(outcome: ImportOutcome, errors: string[]) {
  outcome.errorCount += errors.length;
  outcome.errors.push(...errors.slice(0, MAX_ERROR_LINES - outcome.errors.length));
}

function addBatchResult(outcome: ImportOutcome, res: Exclude<BatchResult, { error: string }>) {
  outcome.imported += res.imported;
  addRowErrors(outcome, res.errors);
  if (outcome.importedIds) {
    outcome.importedIds = outcome.imported <= MAX_ENROLL_IDS ? [...outcome.importedIds, ...res.importedIds] : null;
  }
  if (res.guestLimitReached) outcome.guestLimitReached = true;
}

/**
 * Streams the CSV from disk and sends data rows to the server one batch at a time,
 * so memory stays flat for files up to 1 GB. Only mapped columns are sent.
 */
async function streamImport(
  file: File,
  mapping: Record<string, string>,
  hooks: StreamImportHooks,
): Promise<ImportOutcome> {
  const outcome: ImportOutcome = {
    imported: 0, importedIds: [], errors: [], errorCount: 0,
    guestLimitReached: false, cancelled: false, failure: null,
  };
  const parser = createCsvParser();
  const decoder = new TextDecoder();
  const reader = file.stream().getReader();
  let sendHeaders: string[] | null = null;
  let columns: number[] = [];
  let batch: string[][] = [];
  let batchBytes = 0;
  let batchFirstRow = 2;
  let rowNumber = 1; // the header is row 1
  let bytesRead = 0;

  const flush = async () => {
    if (batch.length === 0 || !sendHeaders) return;
    const firstRowNumber = batchFirstRow;
    const lastRow = firstRowNumber + batch.length - 1;
    let res: BatchResult;
    try {
      res = await importLeadRows({ headers: sendHeaders, rows: batch, mapping, firstRowNumber });
    } catch (err) {
      res = { error: err instanceof Error ? err.message : "Request failed" };
    }
    batch = [];
    batchBytes = 0;
    if ("error" in res) {
      outcome.failure = `Rows ${firstRowNumber}-${lastRow}: ${res.error}`;
      return;
    }
    addBatchResult(outcome, res);
    hooks.onProgress(bytesRead, outcome.imported);
  };

  const shouldStop = () => {
    if (outcome.failure !== null || outcome.guestLimitReached) return true;
    if (hooks.isCancelled()) outcome.cancelled = true;
    return outcome.cancelled;
  };

  const take = async (records: string[][]) => {
    for (const record of records) {
      if (!sendHeaders) {
        const mapped = Array.from(new Set(record.filter((h) => Object.hasOwn(mapping, h))));
        sendHeaders = mapped;
        columns = mapped.map((h) => record.indexOf(h));
        continue;
      }
      rowNumber++;
      const row = columns.map((c) => record[c] ?? "");
      if (row.some((cell) => cell.length > IMPORT_MAX_CELL_CHARS)) {
        // The server numbers a batch's rows consecutively, so send what we have before skipping.
        await flush();
        if (shouldStop()) return;
        addRowErrors(outcome, [`Row ${rowNumber}: ${OVERSIZED_CELL_ERROR}`]);
        continue;
      }
      // Row as JSON: cells, their commas and the brackets.
      const rowBytes = row.reduce((sum, cell) => sum + jsonStringBytes(cell) + 1, 1);
      if (batch.length > 0 && batchBytes + rowBytes > MAX_BATCH_BYTES) {
        await flush();
        if (shouldStop()) return;
      }
      if (batch.length === 0) batchFirstRow = rowNumber;
      batch.push(row);
      batchBytes += rowBytes;
      if (batch.length >= IMPORT_BATCH_ROWS) {
        await flush();
        if (shouldStop()) return;
      }
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      await take(parser.push(decoder.decode(value, { stream: true })));
      if (shouldStop()) break;
      hooks.onProgress(bytesRead, outcome.imported);
    }
    if (!shouldStop()) {
      await take([...parser.push(decoder.decode()), ...parser.end()]);
      if (!shouldStop()) await flush();
    }
  } catch (err) {
    outcome.failure = `Could not read the file: ${err instanceof Error ? err.message : "Unknown error"}`;
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  if (!sendHeaders) outcome.failure = "CSV file is empty or has no headers";
  return outcome;
}

export function ImportLeadsModal({
  open,
  onClose,
  onImportComplete,
}: ImportLeadsModalProps) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<string[][]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<ImportOutcome | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isAiMapping, setIsAiMapping] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState({ bytesRead: 0, imported: 0 });
  const [cancelRequested, setCancelRequested] = useState(false);
  // One controller per import run. Aborting it cancels only that run; close and unmount
  // abort and clear it, so a still-running import stops touching this modal's state.
  const activeRunRef = useRef<AbortController | null>(null);
  const [showSequenceEnroll, setShowSequenceEnroll] = useState(false);
  const [sequences, setSequences] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [selectedSequenceId, setSelectedSequenceId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      activeRunRef.current?.abort();
      activeRunRef.current = null;
    },
    [],
  );

  const resetState = () => {
    setStep("upload");
    setCsvFile(null);
    setFileName("");
    setHeaders([]);
    setPreview([]);
    setFieldMapping({});
    setImportResult(null);
    setIsAiMapping(false);
    setProgress({ bytesRead: 0, imported: 0 });
    setCancelRequested(false);
  };

  const handleSequenceEnroll = async () => {
    if (!selectedSequenceId || !importResult?.importedIds?.length) return;
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
    activeRunRef.current?.abort();
    activeRunRef.current = null;
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

    if (file.size > MAX_FILE_BYTES) {
      toast.error("File too large. Maximum 1 GB.");
      return;
    }

    startTransition(async () => {
      let result: { headers: string[]; rows: string[][] };
      try {
        result = await readCsvPreview(file);
      } catch (err) {
        toast.error(`Could not read the file${err instanceof Error ? `: ${err.message}` : ""}`);
        return;
      }
      if (result.headers.length === 0) {
        toast.error("CSV file is empty or has no headers");
        return;
      }
      setCsvFile(file);
      setFileName(file.name);
      setHeaders(result.headers);
      setPreview(result.rows.slice(0, 5));

      // Auto-map fields using hardcoded dictionary
      const autoMapping: Record<string, string> = {};
      for (const header of result.headers) {
        autoMapping[header] = autoMapField(header);
      }
      setFieldMapping(autoMapping);
      setStep("mapping");
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

  const handleStartImport = async () => {
    if (!hasRequiredField()) {
      toast.error("You must map at least Name or Email");
      return;
    }
    if (!csvFile) return;

    // Filter out skipped fields
    const cleanMapping: Record<string, string> = {};
    for (const [csv, field] of Object.entries(fieldMapping)) {
      if (field !== "__skip__") {
        cleanMapping[csv] = field;
      }
    }

    // A new run gets its own controller; an earlier run stays cancelled.
    activeRunRef.current?.abort();
    const run = new AbortController();
    activeRunRef.current = run;
    const isCurrent = () => activeRunRef.current === run;
    setCancelRequested(false);
    setProgress({ bytesRead: 0, imported: 0 });
    setStep("importing");

    const outcome = await streamImport(csvFile, cleanMapping, {
      onProgress: (bytesRead, imported) => {
        if (isCurrent()) setProgress({ bytesRead, imported });
      },
      isCancelled: () => run.signal.aborted,
    });

    if (!isCurrent()) {
      // The modal was closed or unmounted mid-import; still refresh the list for what landed.
      if (outcome.imported > 0) onImportComplete?.();
      return;
    }
    activeRunRef.current = null;
    if (outcome.failure && outcome.imported === 0 && outcome.errorCount === 0) {
      toast.error(outcome.failure);
      setStep("mapping");
      return;
    }
    if (outcome.failure) toast.error("Import stopped early. See the summary for details.");
    if (outcome.guestLimitReached) toast.error(GUEST_LIMIT_MESSAGE);
    setImportResult(outcome);
    setStep("done");
  };

  const handleCancelImport = () => {
    activeRunRef.current?.abort();
    setCancelRequested(true);
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

  // Capped at 99: reading the whole file is not the same as the last batch being saved.
  // The done step is what reports completion.
  const importPercent = csvFile && csvFile.size > 0
    ? Math.min(99, Math.floor((progress.bytesRead / csvFile.size) * 100))
    : 0;
  const importStopped = importResult?.failure != null;

  return (
    <Modal open={open} onClose={handleClose} className="max-w-2xl">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-heading-md text-fg">
              Import Leads
            </h2>
            <p className="text-sm text-fg-secondary mt-0.5">
              {step === "upload" && "Upload a CSV file to import leads"}
              {step === "mapping" && "Map CSV columns to lead fields"}
              {step === "preview" && "Review data before importing"}
              {step === "importing" && "Importing your leads..."}
              {step === "done" && (importStopped ? "Import stopped on an error" : "Import complete")}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors"
          >
            <XIcon size={20} className="text-fg-secondary" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-4">
          {["Upload", "Map Fields", "Import"].map((label, i) => {
            const stepIndex =
              step === "upload"
                ? 0
                : step === "mapping" || step === "preview"
                  ? 1
                  : step === "importing" || importStopped
                    ? 2
                    : 3;
            return (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                    i < stepIndex
                      ? "bg-success text-on-inverse"
                      : i === stepIndex
                        ? "bg-accent-strong text-on-inverse"
                        : "bg-muted text-fg-muted"
                  }`}
                >
                  {i < stepIndex ? (
                    <CheckCircleIcon size={16} weight="fill" />
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-xs font-medium ${
                    i <= stepIndex
                      ? "text-fg"
                      : "text-fg-muted"
                  }`}
                >
                  {label}
                </span>
                {i < 2 && (
                  <div className="w-6 h-px bg-active" />
                )}
              </div>
            );
          })}
        </div>

        {/* Upload Step */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              data-clay-box className={`relative border border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? "border-accent bg-accent-surface"
                  : "border-line hover:border-fg-muted"
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
                <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                  <UploadIcon
                    size={24}
                    className="text-fg-muted"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-fg">
                    {isPending
                      ? "Processing..."
                      : "Drop your CSV file here, or click to browse"}
                  </p>
                  <p className="text-xs text-fg-muted mt-1">
                    CSV files up to 1 GB
                  </p>
                </div>
              </div>
            </div>

            {/* Template Download */}
            <div className="flex items-center justify-between p-3 rounded-md bg-subtle border border-line">
              <div className="flex items-center gap-2">
                <FileTextIcon
                  size={18}
                  className="text-fg-muted"
                />
                <span className="text-sm text-fg-secondary">
                  Need a template?
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadTemplate();
                }}
                className="text-sm font-medium text-accent-strong hover:underline flex items-center gap-1"
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
            <div className="flex items-center justify-between p-3 rounded-md bg-subtle border border-line">
              <div className="flex items-center gap-2">
                <FileTextIcon size={18} className="text-fg-secondary" />
                <span className="text-sm font-medium text-fg">
                  {fileName}
                </span>
                <Badge variant="info">{csvFile ? formatBytes(csvFile.size) : ""}</Badge>
              </div>
              <button
                onClick={handleAIMapFields}
                disabled={isAiMapping}
                className="flex h-7 items-center gap-1.5 px-2.5 rounded-md bg-accent-strong text-on-inverse hover:bg-accent-strong/90 text-xs font-medium disabled:opacity-50 transition-colors"
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
                  className="flex items-center gap-3 p-3 rounded-md bg-surface border border-line"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-fg truncate">
                      {header}
                    </p>
                    <p className="text-xs text-fg-muted mt-0.5 truncate">
                      e.g. {preview[0]?.[headers.indexOf(header)] || "—"}
                    </p>
                  </div>
                  <ArrowRightIcon
                    size={16}
                    className="text-fg-disabled flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <Select
                      value={fieldMapping[header] || "__skip__"}
                      onChange={(e) =>
                        handleMappingChange(header, e.target.value)
                      }
                    >
                      {LEAD_FIELD_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            {/* Mapping summary */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-fg-secondary">
                {getMappedFieldCount()} of {headers.length} columns mapped
              </span>
              {!hasRequiredField() && (
                <span className="text-danger flex items-center gap-1">
                  <WarningIcon size={14} />
                  Map Name or Email
                </span>
              )}
            </div>

            {/* Preview Table */}
            {preview.length > 0 && (
              <div>
                <p className="text-xs font-medium text-fg-secondary mb-2">
                  Preview (first {Math.min(preview.length, 3)} rows)
                </p>
                <div className="overflow-x-auto rounded-md border border-line">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-row bg-muted">
                        {headers.map((h) => {
                          const mapped = fieldMapping[h];
                          return (
                            <th
                              key={h}
                              className="px-3 py-2 text-left font-medium text-fg-secondary whitespace-nowrap"
                            >
                              {mapped && mapped !== "__skip__" ? (
                                <span className="text-success">
                                  {
                                    LEAD_FIELD_OPTIONS.find(
                                      (o) => o.value === mapped
                                    )?.label
                                  }
                                </span>
                              ) : (
                                <span className="text-fg-disabled line-through">
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
                          className="border-b border-row last:border-0"
                        >
                          {row.map((cell, ci) => {
                            const mapped = fieldMapping[headers[ci]];
                            return (
                              <td
                                key={ci}
                                className={`px-3 py-1.5 whitespace-nowrap ${
                                  mapped && mapped !== "__skip__"
                                    ? "text-fg"
                                    : "text-fg-disabled"
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
                Import Leads
              </Button>
            </div>
          </div>
        )}

        {/* Importing Step */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <CircleNotchIcon
              size={40}
              className="text-accent-strong animate-spin"
            />
            <div className="w-full max-w-sm space-y-2 text-center">
              <p className="text-sm font-medium text-fg">
                Importing leads... {importPercent}%
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent-strong transition-[width]"
                  style={{ width: `${importPercent}%` }}
                />
              </div>
              <p className="text-xs text-fg-secondary">
                {progress.imported.toLocaleString()} lead{progress.imported !== 1 ? "s" : ""} imported
              </p>
              <p className="text-xs text-fg-muted">
                Keep this tab open until the import finishes.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleCancelImport}
              disabled={cancelRequested}
            >
              {cancelRequested ? "Stopping after this batch..." : "Cancel"}
            </Button>
          </div>
        )}

        {/* Done Step */}
        {step === "done" && importResult && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-6 gap-3">
              {importStopped ? (
                <div className="w-14 h-14 rounded-full bg-danger-surface flex items-center justify-center">
                  <WarningIcon size={32} weight="fill" className="text-danger" />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-full bg-success-surface flex items-center justify-center">
                  <CheckCircleIcon
                    size={32}
                    weight="fill"
                    className="text-success"
                  />
                </div>
              )}
              <div className="text-center">
                <p className="text-heading-md text-fg">
                  {importStopped && "Import stopped: "}
                  {importResult.imported} Lead
                  {importResult.imported !== 1 ? "s" : ""} Imported
                </p>
                {importStopped && (
                  <p className="text-sm text-danger mt-1">{importResult.failure}</p>
                )}
                {importStopped && (
                  <p className="text-xs text-fg-secondary mt-1">
                    Rows after the last saved batch were not imported.
                  </p>
                )}
                {importResult.errorCount > 0 && (
                  <p className="text-sm text-warning mt-1">
                    {importResult.errorCount} row
                    {importResult.errorCount !== 1 ? "s" : ""} had issues
                  </p>
                )}
              </div>
            </div>

            {/* Import notes */}
            {(importResult.guestLimitReached || importResult.cancelled || importResult.importedIds === null) && (
              <div className="rounded-md bg-subtle p-3 space-y-1">
                {importResult.guestLimitReached && (
                  <p className="text-sm text-warning">{GUEST_LIMIT_MESSAGE}</p>
                )}
                {importResult.cancelled && (
                  <p className="text-sm text-fg-secondary">
                    Import cancelled. Rows after the last finished batch were not imported.
                  </p>
                )}
                {importResult.importedIds === null && (
                  <p className="text-sm text-fg-secondary">
                    Sequence enrollment from here is available for imports of up to 10,000 leads.
                  </p>
                )}
              </div>
            )}

            {/* Add to Sequence */}
            {importResult.importedIds !== null && importResult.importedIds.length > 0 && !showSequenceEnroll && (
              <button
                onClick={async () => {
                  setShowSequenceEnroll(true);
                  const res = await getSequences();
                  setSequences((res.data ?? []).map((s) => ({ id: s.id, name: s.name, status: s.status })));
                }}
                className="w-full flex h-8 items-center justify-center gap-2 px-3 text-sm font-medium rounded-md border border-line bg-surface text-fg hover:bg-muted transition-colors"
              >
                <PaperPlaneTiltIcon size={16} />
                Add to Sequence
              </button>
            )}

            {showSequenceEnroll && importResult.importedIds !== null && (
              <div className="rounded-lg bg-subtle p-3 space-y-3">
                <p className="text-sm font-medium text-fg">Enroll in Sequence</p>
                <select
                  value={selectedSequenceId ?? ""}
                  onChange={(e) => setSelectedSequenceId(e.target.value || null)}
                  className="w-full h-8 px-2.5 text-sm rounded-md border border-line bg-surface text-fg"
                >
                  <option value="">Select a sequence...</option>
                  {sequences.filter((s) => s.status === "active").map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSequenceEnroll(false)}
                    className="flex-1 h-7 px-2.5 text-xs font-medium text-fg-secondary rounded-md hover:bg-muted hover:text-fg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSequenceEnroll}
                    disabled={!selectedSequenceId || enrolling}
                    className="flex-1 h-7 px-2.5 text-xs font-medium bg-accent-strong text-on-inverse hover:bg-accent-strong/90 rounded-md disabled:opacity-50"
                  >
                    {enrolling ? "Enrolling..." : `Enroll ${importResult.importedIds.length} Leads`}
                  </button>
                </div>
              </div>
            )}

            {/* Errors list */}
            {importResult.errors.length > 0 && (
              <div className="max-h-[120px] overflow-y-auto rounded-md bg-warning-surface p-3 space-y-1">
                {importResult.errors.map((err, i) => (
                  <p
                    key={i}
                    className="text-xs text-warning"
                  >
                    {err}
                  </p>
                ))}
                {importResult.errorCount > importResult.errors.length && (
                  <p className="text-xs text-warning mt-1">
                    ...and {importResult.errorCount - importResult.errors.length} more
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
