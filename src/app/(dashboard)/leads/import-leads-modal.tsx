"use client";

import * as React from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { AlertCircle, FileSpreadsheet, Loader2, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type LeadFieldKey =
  | "name"
  | "first_name"
  | "last_name"
  | "date_of_birth"
  | "gender"
  | "race"
  | "language"
  | "phone_home"
  | "phone"
  | "email"
  | "address_line1"
  | "city"
  | "state"
  | "zip"
  | "insurance_type"
  | "insurance_payer"
  | "insurance_id"
  | "secondary_insurance_type"
  | "secondary_insurance_payer"
  | "mco"
  | "active"
  | "activated_date"
  | "assigned_staff_name"
  | "therapist_name"
  | "referral_source"
  | "referral_type"
  | "office"
  | "diagnosis_1"
  | "diagnosis_2"
  | "diagnosis_3"
  | "diagnosis_4"
  | "diagnosis_5"
  | "diagnosis_6"
  | "diagnosis_7"
  | "external_record_id"
  | "external_client_id";

type ParsedRow = Record<string, string>;

type MappedLead = Partial<Record<LeadFieldKey, string | boolean | null>>;

type PreviewResponse = {
  ok?: boolean;
  imported?: number;
  skipped?: number;
  duplicates?: number;
  errors?: string[];
  preview?: {
    totalRows: number;
    importable: number;
    rowPreview: Array<{
      row: number;
      isDuplicate: boolean;
      isInvalid: boolean;
      reasons: string[];
    }>;
  };
  error?: string;
};

type ImportResult = {
  imported: number;
  skipped: number;
  duplicates: number;
  errors: string[];
};

type ImportLeadsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (result: ImportResult) => Promise<void> | void;
};

const FIELD_DEFINITIONS: Array<{ key: LeadFieldKey; label: string }> = [
  { key: "name", label: "Full Name" },
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "external_client_id", label: "Client ID" },
  { key: "external_record_id", label: "Record ID" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone Cell" },
  { key: "phone_home", label: "Phone Home" },
  { key: "date_of_birth", label: "DOB" },
  { key: "gender", label: "Gender" },
  { key: "race", label: "Race" },
  { key: "language", label: "Language" },
  { key: "address_line1", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "ZIP" },
  { key: "insurance_type", label: "Insurance Type" },
  { key: "insurance_payer", label: "Insurance Payer" },
  { key: "insurance_id", label: "Insurance ID" },
  { key: "secondary_insurance_type", label: "Secondary Insurance Type" },
  { key: "secondary_insurance_payer", label: "Secondary Insurance Payer" },
  { key: "mco", label: "MCO" },
  { key: "active", label: "Active" },
  { key: "activated_date", label: "Activated Date" },
  { key: "assigned_staff_name", label: "Assigned Staff" },
  { key: "therapist_name", label: "Therapist Name" },
  { key: "referral_source", label: "Referral Source" },
  { key: "referral_type", label: "Referral Type" },
  { key: "office", label: "Office" },
  { key: "diagnosis_1", label: "Diagnosis 1" },
  { key: "diagnosis_2", label: "Diagnosis 2" },
  { key: "diagnosis_3", label: "Diagnosis 3" },
  { key: "diagnosis_4", label: "Diagnosis 4" },
  { key: "diagnosis_5", label: "Diagnosis 5" },
  { key: "diagnosis_6", label: "Diagnosis 6" },
  { key: "diagnosis_7", label: "Diagnosis 7" },
];

const CAROLINA_HEADER_MAP: Record<string, LeadFieldKey> = {
  clientid: "external_client_id",
  recordid: "external_record_id",
  firstname: "first_name",
  lastname: "last_name",
  fullname: "name",
  dob: "date_of_birth",
  gender: "gender",
  race: "race",
  language: "language",
  phonehome: "phone_home",
  phonecell: "phone",
  emailaddress: "email",
  address: "address_line1",
  city: "city",
  state: "state",
  zipcode: "zip",
  insurancetype: "insurance_type",
  insurancepayer: "insurance_payer",
  insuranceid: "insurance_id",
  secondaryinsurancetype: "secondary_insurance_type",
  secondaryinsurancepayer: "secondary_insurance_payer",
  mco: "mco",
  active: "active",
  activateddate: "activated_date",
  assignedstaffname: "assigned_staff_name",
  therapistname: "therapist_name",
  referralsource: "referral_source",
  referraltype: "referral_type",
  office: "office",
  diagnosis1: "diagnosis_1",
  diagnosis2: "diagnosis_2",
  diagnosis3: "diagnosis_3",
  diagnosis4: "diagnosis_4",
  diagnosis5: "diagnosis_5",
  diagnosis6: "diagnosis_6",
  diagnosis7: "diagnosis_7",
};

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toCellString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function parseBooleanLike(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "yes" || normalized === "y" || normalized === "1";
}

function emptyMapping(): Record<LeadFieldKey, string> {
  const mapping = {} as Record<LeadFieldKey, string>;
  for (const field of FIELD_DEFINITIONS) mapping[field.key] = "";
  return mapping;
}

function hasRequiredNameMapping(mapping: Record<LeadFieldKey, string>) {
  const hasName = Boolean(mapping.name);
  const hasSplitName = Boolean(mapping.first_name && mapping.last_name);
  return hasName || hasSplitName;
}

export function ImportLeadsModal({ open, onOpenChange, onImported }: ImportLeadsModalProps) {
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<ParsedRow[]>([]);
  const [mapping, setMapping] = React.useState<Record<LeadFieldKey, string>>(emptyMapping);
  const [carolinaDetected, setCarolinaDetected] = React.useState(false);
  const [skipDuplicates, setSkipDuplicates] = React.useState(true);
  const [isLoadingPreview, setIsLoadingPreview] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<PreviewResponse | null>(null);

  const headerOptions = React.useMemo<SelectOption[]>(() => {
    return [{ value: "", label: "Not mapped" }, ...headers.map((header) => ({ value: header, label: header }))];
  }, [headers]);

  const mappedRows = React.useMemo<MappedLead[]>(() => {
    return rows.map((row) => {
      const lead: MappedLead = {};
      for (const [fieldKey, sourceHeader] of Object.entries(mapping) as Array<[LeadFieldKey, string]>) {
        if (!sourceHeader) continue;
        const raw = toCellString(row[sourceHeader]);
        if (!raw) continue;
        lead[fieldKey] = fieldKey === "active" ? parseBooleanLike(raw) : raw;
      }
      return lead;
    });
  }, [mapping, rows]);

  const mappingError = React.useMemo(() => {
    if (!rows.length) return "Upload a CSV or Excel file to continue.";
    if (!hasRequiredNameMapping(mapping)) {
      return "Map either Full Name, or both First Name and Last Name.";
    }
    return null;
  }, [mapping, rows.length]);

  const previewRows = React.useMemo(() => mappedRows.slice(0, 10), [mappedRows]);

  const reset = React.useCallback(() => {
    setStep(1);
    setFileName(null);
    setHeaders([]);
    setRows([]);
    setMapping(emptyMapping());
    setCarolinaDetected(false);
    setSkipDuplicates(true);
    setIsLoadingPreview(false);
    setIsImporting(false);
    setError(null);
    setPreview(null);
  }, []);

  const parseUploadedFile = React.useCallback(async (file: File) => {
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith(".csv")) {
      const parsed = await new Promise<Papa.ParseResult<Record<string, unknown>>>((resolve, reject) => {
        Papa.parse<Record<string, unknown>>(file, {
          header: true,
          skipEmptyLines: true,
          complete: resolve,
          error: reject,
        });
      });

      const csvHeaders = (parsed.meta.fields ?? []).filter(Boolean);
      const csvRows = (parsed.data ?? []).map((entry) => {
        const row: ParsedRow = {};
        for (const header of csvHeaders) row[header] = toCellString(entry[header]);
        return row;
      });

      return { parsedHeaders: csvHeaders, parsedRows: csvRows };
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheet = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheet];

    const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });

    const excelHeaders = jsonRows.length ? Object.keys(jsonRows[0]) : [];
    const excelRows = jsonRows.map((entry) => {
      const row: ParsedRow = {};
      for (const header of excelHeaders) row[header] = toCellString(entry[header]);
      return row;
    });

    return { parsedHeaders: excelHeaders, parsedRows: excelRows };
  }, []);

  function detectAndBuildMapping(uploadHeaders: string[]) {
    const nextMapping = emptyMapping();
    let matched = 0;

    for (const header of uploadHeaders) {
      const key = CAROLINA_HEADER_MAP[normalizeHeader(header)];
      if (!key) continue;
      if (!nextMapping[key]) {
        nextMapping[key] = header;
        matched += 1;
      }
    }

    setMapping(nextMapping);
    setCarolinaDetected(matched >= 8);
  }

  async function handleFilePicked(file: File | null) {
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const valid = lowerName.endsWith(".csv") || lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls");
    if (!valid) {
      setError("Please upload a CSV or Excel file (.csv, .xlsx, .xls).");
      return;
    }

    setError(null);
    setPreview(null);
    setFileName(file.name);

    try {
      const { parsedHeaders, parsedRows } = await parseUploadedFile(file);
      if (!parsedHeaders.length || !parsedRows.length) {
        setError("No rows were found in this file.");
        return;
      }

      setHeaders(parsedHeaders);
      setRows(parsedRows);
      detectAndBuildMapping(parsedHeaders);
      setStep(1);
    } catch (parseError: unknown) {
      setError(parseError instanceof Error ? parseError.message : "Failed to parse uploaded file.");
    }
  }

  async function loadPreview() {
    if (mappingError) {
      setError(mappingError);
      return;
    }

    setError(null);
    setPreview(null);
    setIsLoadingPreview(true);

    try {
      const response = await fetch("/api/leads/bulk-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leads: mappedRows, skipDuplicates, previewOnly: true }),
      });

      const json = (await response.json().catch(() => null)) as PreviewResponse | null;
      if (!response.ok || !json?.ok) {
        setError(json?.error ?? `Failed to analyze import (${response.status}).`);
        return;
      }

      setPreview(json);
      setStep(3);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to analyze import.");
    } finally {
      setIsLoadingPreview(false);
    }
  }

  async function submitImport() {
    if (!mappedRows.length) {
      setError("No rows available to import.");
      return;
    }

    setError(null);
    setIsImporting(true);

    try {
      const response = await fetch("/api/leads/bulk-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leads: mappedRows, skipDuplicates }),
      });

      const json = (await response.json().catch(() => null)) as PreviewResponse | null;
      if (!response.ok || !json?.ok) {
        setError(json?.error ?? `Import failed (${response.status}).`);
        return;
      }

      await onImported({
        imported: json.imported ?? 0,
        skipped: json.skipped ?? 0,
        duplicates: json.duplicates ?? 0,
        errors: json.errors ?? [],
      });
      onOpenChange(false);
      reset();
    } catch (importError: unknown) {
      setError(importError instanceof Error ? importError.message : "Import failed.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import Leads</DialogTitle>
          <DialogDescription>
            Upload CSV/Excel, map fields, review duplicates, then import leads into your current organization.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant={step === 1 ? "default" : "secondary"}>1. Upload</Badge>
          <Badge variant={step === 2 ? "default" : "secondary"}>2. Mapping</Badge>
          <Badge variant={step === 3 ? "default" : "secondary"}>3. Review</Badge>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="space-y-4">
          {step === 1 ? (
            <div className="space-y-4">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center hover:bg-zinc-100">
                <Upload className="h-6 w-6 text-zinc-600" />
                <div className="text-sm font-medium text-zinc-800">Drop a file here or click to upload</div>
                <div className="text-xs text-zinc-600">Supported: .csv, .xlsx, .xls</div>
                <Input
                  type="file"
                  className="hidden"
                  accept=".csv,.xlsx,.xls"
                  onChange={(event) => {
                    void handleFilePicked(event.target.files?.[0] ?? null);
                    event.currentTarget.value = "";
                  }}
                />
              </label>

              {fileName ? (
                <div className="flex items-center gap-2 rounded-md border bg-white p-3 text-sm text-zinc-700">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>{fileName}</span>
                  <span className="text-zinc-500">({rows.length} rows)</span>
                </div>
              ) : null}

              {carolinaDetected ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                  Carolina CSS format detected. We pre-mapped columns automatically.
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div className="text-sm text-zinc-600">Map spreadsheet columns to lead fields.</div>
              <div className="grid gap-3 md:grid-cols-2">
                {FIELD_DEFINITIONS.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <div className="text-sm font-medium text-zinc-900">{field.label}</div>
                    <Select
                      value={mapping[field.key]}
                      options={headerOptions}
                      onChange={(event) =>
                        setMapping((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="text-xs text-zinc-500">
                Required: either map Full Name, or both First Name and Last Name.
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4 rounded-md border bg-zinc-50 p-3 text-sm">
                <div>Total rows: {preview?.preview?.totalRows ?? mappedRows.length}</div>
                <div>Importable: {preview?.preview?.importable ?? 0}</div>
                <div>Duplicates: {preview?.duplicates ?? 0}</div>
                <div>Will skip: {skipDuplicates ? preview?.skipped ?? 0 : 0}</div>
              </div>

              {preview?.errors?.length ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {preview.errors.slice(0, 5).map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              ) : null}

              <div className="space-y-2">
                <div className="text-sm font-medium text-zinc-900">Preview (first 10 rows)</div>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-zinc-50 text-zinc-700">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Name</th>
                        <th className="px-3 py-2 text-left font-medium">Email</th>
                        <th className="px-3 py-2 text-left font-medium">Phone</th>
                        <th className="px-3 py-2 text-left font-medium">Client ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((lead, index) => {
                        const first = String(lead.first_name ?? "").trim();
                        const last = String(lead.last_name ?? "").trim();
                        const explicitName = String(lead.name ?? "").trim();
                        const computedName = explicitName || `${first} ${last}`.trim() || "—";
                        return (
                          <tr key={index} className="border-t">
                            <td className="px-3 py-2">{computedName}</td>
                            <td className="px-3 py-2">{String(lead.email ?? "—")}</td>
                            <td className="px-3 py-2">{String(lead.phone ?? "—")}</td>
                            <td className="px-3 py-2">{String(lead.external_client_id ?? "—")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium text-zinc-900">Skip duplicates automatically</div>
                  <div className="text-xs text-zinc-600">Duplicate checks use email and client ID within this organization.</div>
                </div>
                <Switch checked={skipDuplicates} onCheckedChange={setSkipDuplicates} id="skip-duplicates" />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((current) => (current === 3 ? 2 : 1))}
              disabled={isLoadingPreview || isImporting}
            >
              Back
            </Button>
          ) : (
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isLoadingPreview || isImporting}>
                Cancel
              </Button>
            </DialogClose>
          )}

          {step === 1 ? (
            <>
              <Button type="button" variant="outline" disabled={!rows.length || isLoadingPreview} onClick={() => setStep(2)}>
                Manual Mapping
              </Button>
              <Button
                type="button"
                disabled={!rows.length || isLoadingPreview}
                onClick={() => {
                  if (carolinaDetected) {
                    void loadPreview();
                  } else {
                    setStep(2);
                  }
                }}
              >
                {isLoadingPreview ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Preparing...
                  </>
                ) : carolinaDetected ? (
                  "Continue to Review"
                ) : (
                  "Continue"
                )}
              </Button>
            </>
          ) : null}

          {step === 2 ? (
            <Button type="button" onClick={() => void loadPreview()} disabled={Boolean(mappingError) || isLoadingPreview}>
              {isLoadingPreview ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Review Import"
              )}
            </Button>
          ) : null}

          {step === 3 ? (
            <Button type="button" onClick={() => void submitImport()} disabled={isImporting || isLoadingPreview}>
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                "Import Leads"
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
