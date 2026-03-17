import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

type ClientImportRow = {
  organization_id: string;
  client_id_external: string;
  first_name: string | null;
  last_name: string | null;
  age: number | null;
  gender: string | null;
  city: string | null;
  zip_code: string | null;
  diagnosis_code_1: string | null;
  diagnosis_code_2: string | null;
  primary_payer: string | null;
  lead_quality_score: number | null;
  priority_level: "high" | "medium" | "low" | null;
  geographic_priority: string | null;
  age_category: string | null;
  diagnosis_priority: string | null;
  reasoning: string | null;
  source: string;
  raw_payload: Record<string, unknown>;
};

function parseArgs(argv: string[]): { filePath: string; organizationId: string } {
  const args = new Map<string, string>();

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    const next = argv[i + 1];

    if (current.startsWith("--") && next && !next.startsWith("--")) {
      args.set(current, next);
      i += 1;
    }
  }

  const filePath = args.get("--file") ?? "";
  const organizationId = args.get("--org") ?? "";

  if (!filePath || !organizationId) {
    throw new Error("Usage: npm run import:clients -- --file /absolute/path/to/file.xlsx --org <organization_uuid>");
  }

  return { filePath, organizationId };
}

function asTrimmedString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function asPriority(value: unknown): "high" | "medium" | "low" | null {
  const text = asTrimmedString(value)?.toLowerCase();
  if (text === "high" || text === "medium" || text === "low") return text;
  return null;
}

function normalizeZip(value: unknown): string | null {
  const text = asTrimmedString(value);
  if (!text) return null;
  return text.replace(/\.0$/, "");
}

function normalizeRow(input: Record<string, unknown>, organizationId: string): ClientImportRow | null {
  const externalIdRaw = asTrimmedString(input.ClientID);
  if (!externalIdRaw) return null;

  const leadScore = asNullableNumber(input.lead_quality_score);

  return {
    organization_id: organizationId,
    client_id_external: externalIdRaw,
    first_name: asTrimmedString(input.First_Name),
    last_name: asTrimmedString(input.Last_Name),
    age: asNullableNumber(input.Age),
    gender: asTrimmedString(input.Gender),
    city: asTrimmedString(input.City),
    zip_code: normalizeZip(input.Zip),
    diagnosis_code_1: asTrimmedString(input.DX1),
    diagnosis_code_2: asTrimmedString(input.DX2),
    primary_payer: asTrimmedString(input.Insurance),
    lead_quality_score: leadScore,
    priority_level: asPriority(input.priority_level),
    geographic_priority: asTrimmedString(input.geographic_priority),
    age_category: asTrimmedString(input.age_category),
    diagnosis_priority: asTrimmedString(input.diagnosis_priority),
    reasoning: asTrimmedString(input.reasoning),
    source: "checkpoint",
    raw_payload: input,
  };
}

async function main(): Promise<void> {
  const { filePath, organizationId } = parseArgs(process.argv.slice(2));
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  }

  const workbook = XLSX.readFile(resolvedPath);
  const leadScoresSheet = workbook.Sheets["Lead Scores"] ?? workbook.Sheets[workbook.SheetNames[0]];

  if (!leadScoresSheet) {
    throw new Error("No worksheet found in workbook.");
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(leadScoresSheet, {
    defval: null,
    raw: false,
  });

  const normalizedRows = rawRows
    .map((row) => normalizeRow(row, organizationId))
    .filter((row): row is ClientImportRow => row !== null);

  if (normalizedRows.length === 0) {
    throw new Error("No valid client rows found to import.");
  }

  const dedupedMap = new Map<string, ClientImportRow>();
  for (const row of normalizedRows) {
    const key = `${row.organization_id}:${row.client_id_external}`;
    dedupedMap.set(key, row);
  }
  const dedupedRows = Array.from(dedupedMap.values());

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase.from("clients").upsert(dedupedRows, {
    onConflict: "organization_id,client_id_external",
    ignoreDuplicates: false,
  });

  if (error) {
    throw new Error(`Supabase import failed: ${error.message}`);
  }

  const duplicateCount = normalizedRows.length - dedupedRows.length;
  console.log(
    `Imported ${dedupedRows.length} clients for organization ${organizationId}. Duplicates skipped in batch: ${duplicateCount}.`
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
