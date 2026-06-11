import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import {
  buildHistoricalPattern,
  scoreLead,
  type HistoricalClientRow,
  type LeadForScoring,
} from "@/lib/ai/lead-classifier";

type UserOrgRow = { organization_id: string | null };

type BulkLeadInput = {
  name?: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string | null;
  gender?: string | null;
  race?: string | null;
  language?: string | null;
  phone_home?: string | null;
  phone?: string | null;
  email?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  insurance_type?: string | null;
  insurance_payer?: string | null;
  insurance_id?: string | null;
  secondary_insurance_type?: string | null;
  secondary_insurance_payer?: string | null;
  mco?: string | null;
  active?: boolean | null;
  activated_date?: string | null;
  assigned_staff_name?: string | null;
  therapist_name?: string | null;
  referral_source?: string | null;
  referral_type?: string | null;
  office?: string | null;
  diagnosis_1?: string | null;
  diagnosis_2?: string | null;
  diagnosis_3?: string | null;
  diagnosis_4?: string | null;
  diagnosis_5?: string | null;
  diagnosis_6?: string | null;
  diagnosis_7?: string | null;
  external_record_id?: string | null;
  external_client_id?: string | null;
};

type BulkImportRequest = {
  leads?: BulkLeadInput[];
  skipDuplicates?: boolean;
  previewOnly?: boolean;
};

type ExistingLeadDuplicateRow = {
  email: string | null;
  external_client_id: string | null;
};

type RowPreview = {
  row: number;
  isDuplicate: boolean;
  isInvalid: boolean;
  reasons: string[];
};

function asOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function asLowerTrimmed(value: unknown): string | null {
  const normalized = asOptionalString(value);
  return normalized ? normalized.toLowerCase() : null;
}

function asOptionalDate(value: unknown): string | null {
  const input = asOptionalString(value);
  if (!input) return null;

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10);
}

function ageFromDob(dobIso: string | null): number | null {
  if (!dobIso) return null;
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age -= 1;
  return Number.isFinite(age) ? age : null;
}

function titleCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (!items.length) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function buildLeadName(item: BulkLeadInput): string {
  const explicitName = asOptionalString(item.name);
  if (explicitName) return explicitName;

  const first = asOptionalString(item.first_name) ?? "";
  const last = asOptionalString(item.last_name) ?? "";
  return `${first} ${last}`.trim();
}

function buildLocation(city: string | null, state: string | null): string | null {
  if (city && state) return `${city}, ${state}`;
  return city ?? state ?? null;
}

function buildNeedType(item: BulkLeadInput): string {
  return (
    asOptionalString(item.referral_type) ??
    asOptionalString(item.diagnosis_1) ??
    asOptionalString(item.insurance_type) ??
    "General"
  );
}

export async function POST(request: Request) {
  try {
    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as BulkImportRequest | null;
    const leads = Array.isArray(body?.leads) ? body.leads : [];

    const skipDuplicates = body?.skipDuplicates !== false;
    const previewOnly = body?.previewOnly === true;

    if (!leads.length) {
      return NextResponse.json({ ok: false, error: "No leads provided" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    const { data: userRow, error: userErr } = await admin
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .limit(1)
      .maybeSingle<UserOrgRow>();

    if (userErr || !userRow?.organization_id) {
      return NextResponse.json(
        { ok: false, error: userErr?.message ?? "Missing organization" },
        { status: 500 }
      );
    }

    const organizationId = userRow.organization_id;

    const { data: patternRows, error: patternErr } = await admin
      .from("clients")
      .select("age,city,zip_code,diagnosis_code_1,diagnosis_code_2,primary_payer,lead_quality_score")
      .eq("organization_id", organizationId)
      .not("lead_quality_score", "is", null)
      .limit(5000);

    if (patternErr) {
      return NextResponse.json({ ok: false, error: patternErr.message }, { status: 500 });
    }

    const historicalPattern = buildHistoricalPattern((patternRows ?? []) as HistoricalClientRow[]);

    const emailCandidates = leads
      .map((lead) => asLowerTrimmed(lead.email))
      .filter((value): value is string => Boolean(value));

    const clientIdCandidates = leads
      .map((lead) => asLowerTrimmed(lead.external_client_id))
      .filter((value): value is string => Boolean(value));

    const existingEmailSet = new Set<string>();
    const existingClientIdSet = new Set<string>();

    const uniqueEmailCandidates = Array.from(new Set(emailCandidates));
    const uniqueClientIdCandidates = Array.from(new Set(clientIdCandidates));

    for (const emailChunk of chunkArray(uniqueEmailCandidates, 200)) {
      const { data, error } = await admin
        .from("leads")
        .select("email,external_client_id")
        .eq("organization_id", organizationId)
        .in("email", emailChunk);

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      for (const row of (data ?? []) as ExistingLeadDuplicateRow[]) {
        const email = asLowerTrimmed(row.email);
        if (email) existingEmailSet.add(email);
      }
    }

    for (const clientIdChunk of chunkArray(uniqueClientIdCandidates, 200)) {
      const { data, error } = await admin
        .from("leads")
        .select("email,external_client_id")
        .eq("organization_id", organizationId)
        .in("external_client_id", clientIdChunk);

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      for (const row of (data ?? []) as ExistingLeadDuplicateRow[]) {
        const externalClientId = asLowerTrimmed(row.external_client_id);
        if (externalClientId) existingClientIdSet.add(externalClientId);
      }
    }

    const seenImportEmails = new Set<string>();
    const seenImportClientIds = new Set<string>();

    const errors: string[] = [];
    const rowsToInsert: Record<string, unknown>[] = [];
    const rowPreview: RowPreview[] = [];

    let duplicates = 0;
    let skipped = 0;

    for (const [index, item] of leads.entries()) {
      const leadName = buildLeadName(item);
      if (!leadName) {
        skipped += 1;
        errors.push(`Row ${index + 1}: missing required name`);
        rowPreview.push({
          row: index + 1,
          isDuplicate: false,
          isInvalid: true,
          reasons: ["Missing required name (first/last or full name)"],
        });
        continue;
      }

      const normalizedEmail = asLowerTrimmed(item.email);
      const normalizedExternalClientId = asLowerTrimmed(item.external_client_id);

      const duplicateByExistingEmail = normalizedEmail ? existingEmailSet.has(normalizedEmail) : false;
      const duplicateByExistingClientId = normalizedExternalClientId
        ? existingClientIdSet.has(normalizedExternalClientId)
        : false;
      const duplicateInFileEmail = normalizedEmail ? seenImportEmails.has(normalizedEmail) : false;
      const duplicateInFileClientId = normalizedExternalClientId
        ? seenImportClientIds.has(normalizedExternalClientId)
        : false;

      const isDuplicate =
        duplicateByExistingEmail ||
        duplicateByExistingClientId ||
        duplicateInFileEmail ||
        duplicateInFileClientId;

      const duplicateReasons: string[] = [];
      if (duplicateByExistingEmail) duplicateReasons.push("Email already exists in this organization");
      if (duplicateByExistingClientId) duplicateReasons.push("ClientID already exists in this organization");
      if (duplicateInFileEmail) duplicateReasons.push("Email is duplicated in the uploaded file");
      if (duplicateInFileClientId) duplicateReasons.push("ClientID is duplicated in the uploaded file");

      if (isDuplicate) {
        duplicates += 1;
        rowPreview.push({
          row: index + 1,
          isDuplicate: true,
          isInvalid: false,
          reasons: duplicateReasons,
        });
        if (skipDuplicates) {
          skipped += 1;
          continue;
        }
      } else {
        rowPreview.push({
          row: index + 1,
          isDuplicate: false,
          isInvalid: false,
          reasons: [],
        });
      }

      if (normalizedEmail) seenImportEmails.add(normalizedEmail);
      if (normalizedExternalClientId) seenImportClientIds.add(normalizedExternalClientId);

      const city = asOptionalString(item.city);
      const state = asOptionalString(item.state);
      const referralSource = asOptionalString(item.referral_source) ?? "Carolina CSS Website";
      const active = item.active === true;
      const firstName = asOptionalString(item.first_name);
      const lastName = asOptionalString(item.last_name);
      const zip = asOptionalString(item.zip);
      const dobIso = asOptionalDate(item.date_of_birth);
      const scoringInput: LeadForScoring = {
        name: leadName,
        age: ageFromDob(dobIso),
        city,
        location: buildLocation(city, state),
        zipCode: zip,
        diagnosis1: asOptionalString(item.diagnosis_1),
        diagnosis2: asOptionalString(item.diagnosis_2),
        insurance:
          asOptionalString(item.insurance_payer) ??
          asOptionalString(item.insurance_type) ??
          asOptionalString(item.mco),
        services: [asOptionalString(item.referral_type), asOptionalString(item.office)].filter(
          (value): value is string => Boolean(value)
        ),
      };

      const scoreResult = await scoreLead(scoringInput, historicalPattern);

      const rowData = {
        organization_id: organizationId,
        name: leadName,
        first_name: firstName,
        last_name: lastName,
        email: asOptionalString(item.email),
        phone: asOptionalString(item.phone),
        phone_home: asOptionalString(item.phone_home),
        location: buildLocation(city, state),
        need_type: buildNeedType(item),
        source: referralSource,
        referral_source: referralSource,
        status: "new",
        urgency: "medium",
        qualification_score: 0,
        quality_score: scoreResult.score,
        priority: titleCase(scoreResult.priority),
        ai_reasoning: scoreResult.reasoning,
        active,
        date_of_birth: dobIso,
        gender: asOptionalString(item.gender),
        race: asOptionalString(item.race),
        language: asOptionalString(item.language),
        address_line1: asOptionalString(item.address_line1),
        city,
        state,
        zip,
        zip_code: zip,
        insurance_type: asOptionalString(item.insurance_type),
        insurance_payer: asOptionalString(item.insurance_payer),
        insurance_id: asOptionalString(item.insurance_id),
        secondary_insurance_type: asOptionalString(item.secondary_insurance_type),
        secondary_insurance_payer: asOptionalString(item.secondary_insurance_payer),
        mco: asOptionalString(item.mco),
        activated_date: asOptionalDate(item.activated_date),
        assigned_staff_name: asOptionalString(item.assigned_staff_name),
        therapist_name: asOptionalString(item.therapist_name),
        referral_type: asOptionalString(item.referral_type),
        office: asOptionalString(item.office),
        diagnosis_1: asOptionalString(item.diagnosis_1),
        diagnosis_2: asOptionalString(item.diagnosis_2),
        diagnosis_3: asOptionalString(item.diagnosis_3),
        diagnosis_4: asOptionalString(item.diagnosis_4),
        diagnosis_5: asOptionalString(item.diagnosis_5),
        diagnosis_6: asOptionalString(item.diagnosis_6),
        diagnosis_7: asOptionalString(item.diagnosis_7),
        external_record_id: asOptionalString(item.external_record_id),
        external_client_id: asOptionalString(item.external_client_id),
        raw_data: {
          active,
          import_source: "bulk_upload",
          imported_by: user.id,
        },
      };

      rowsToInsert.push(rowData);
    }

    if (previewOnly) {
      return NextResponse.json({
        ok: true,
        imported: 0,
        skipped,
        duplicates,
        errors,
        preview: {
          totalRows: leads.length,
          importable: rowsToInsert.length,
          rowPreview,
        },
      });
    }

    let imported = 0;

    for (const insertChunk of chunkArray(rowsToInsert, 200)) {
      const { error } = await admin.from("leads").insert(insertChunk);
      if (error) {
        skipped += insertChunk.length;
        errors.push(error.message);
        continue;
      }
      imported += insertChunk.length;
    }

    return NextResponse.json({
      ok: true,
      imported,
      skipped,
      duplicates,
      errors,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
