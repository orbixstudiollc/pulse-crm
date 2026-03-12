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
} from "@/components/ui";
import { parseCSVPreview, importLeads } from "@/lib/actions/import";
import { toast } from "sonner";

interface ImportLeadsModalProps {
  open: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

type ImportStep = "upload" | "mapping" | "preview" | "importing" | "done";

const LEAD_FIELD_OPTIONS = [
  { label: "— Skip this column —", value: "__skip__" },
  { label: "Name", value: "name" },
  { label: "Email", value: "email" },
  { label: "Company", value: "company" },
  { label: "Phone", value: "phone" },
  { label: "Status (hot/warm/cold)", value: "status" },
  { label: "Source", value: "source" },
  { label: "Industry", value: "industry" },
  { label: "Employees", value: "employees" },
  { label: "Website", value: "website" },
  { label: "Estimated Value", value: "estimated_value" },
  { label: "Location", value: "location" },
  { label: "LinkedIn URL", value: "linkedin" },
];

function autoMapField(header: string): string {
  const h = header.toLowerCase().trim();
  const mappings: Record<string, string> = {
    name: "name",
    "full name": "name",
    "lead name": "name",
    "contact name": "name",
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
    status: "status",
    "lead status": "status",
    source: "source",
    "lead source": "source",
    industry: "industry",
    sector: "industry",
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
  };
  return mappings[h] || "__skip__";
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
    errors: string[];
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [dragActive, setDragActive] = useState(false);
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
  };

  const handleClose = () => {
    resetState();
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

        // Auto-map fields
        const autoMapping: Record<string, string> = {};
        for (const header of result.data.headers) {
          autoMapping[header] = autoMapField(header);
        }
        setFieldMapping(autoMapping);
        setStep("mapping");
      }
    });
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
      setImportResult(result.data || { imported: 0, errors: [] });
      setStep("done");
    });
  };

  const handleDownloadTemplate = () => {
    const templateCSV =
      "Name,Email,Company,Phone,Status,Source,Industry,Employees,Website,Estimated Value,Location,LinkedIn\nJohn Doe,john@example.com,Acme Corp,+1234567890,warm,Website,Technology,50,https://acme.com,5000,New York,https://linkedin.com/in/johndoe\nJane Smith,jane@example.com,Globex Inc,+0987654321,hot,Referral,Finance,200,https://globex.com,15000,London,https://linkedin.com/in/janesmith";
    const blob = new Blob([templateCSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Template downloaded!");
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
          {["Upload", "Map Fields", "Import"].map((label, i) => {
            const stepIndex =
              step === "upload"
                ? 0
                : step === "mapping" || step === "preview"
                  ? 1
                  : 2;
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
                {i < 2 && (
                  <div className="w-8 h-px bg-neutral-200 dark:bg-neutral-700" />
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
            {/* File info */}
            <div className="flex items-center justify-between p-3 rounded bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <FileTextIcon size={18} className="text-neutral-500" />
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {fileName}
                </span>
              </div>
              <Badge variant="blue">{totalRows} rows</Badge>
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
                  Preview (first {preview.length} rows)
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

        {/* Done Step */}
        {step === "done" && importResult && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-8 gap-3">
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

            {/* Errors list */}
            {importResult.errors.length > 0 && (
              <div className="max-h-[160px] overflow-y-auto rounded border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-1">
                {importResult.errors.map((err, i) => (
                  <p
                    key={i}
                    className="text-xs text-amber-700 dark:text-amber-300"
                  >
                    {err}
                  </p>
                ))}
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
