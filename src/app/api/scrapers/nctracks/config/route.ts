import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";

type ScraperConfigRow = {
  id: string;
  is_enabled: boolean;
  frequency: "hourly" | "daily" | "weekly";
  target_volume: number;
  filters: {
    counties: string[];
    zipCodes?: string[];
    serviceTypes: string[];
    insuranceProviders: string[];
  } | null;
  keywords: string[] | null;
};

type UserOrgRow = {
  organization_id: string | null;
};

const DEFAULT_FILTERS = {
  counties: ["Durham", "Wake", "Cumberland"],
  serviceTypes: ["Mental Health", "Behavioral Health", "Substance Abuse"],
  insuranceProviders: ["Alliance", "AmeriHealth", "Carolina Complete"],
};

const DEFAULT_KEYWORDS = ["PTSD", "substance abuse", "counseling", "therapy"];

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeFilters(value: unknown): ScraperConfigRow["filters"] {
  if (!value || typeof value !== "object") return DEFAULT_FILTERS;
  const source = value as Record<string, unknown>;

  const counties = normalizeStringArray(source.counties);
  const zipCodes = normalizeStringArray(source.zipCodes);
  const serviceTypes = normalizeStringArray(source.serviceTypes);
  const insuranceProviders = normalizeStringArray(source.insuranceProviders);

  return {
    counties: counties.length ? counties : DEFAULT_FILTERS.counties,
    zipCodes: zipCodes.length ? zipCodes : undefined,
    serviceTypes: serviceTypes.length ? serviceTypes : DEFAULT_FILTERS.serviceTypes,
    insuranceProviders: insuranceProviders.length ? insuranceProviders : DEFAULT_FILTERS.insuranceProviders,
  };
}

async function getOrgIdForCurrentUser() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) return { user: null, orgId: null };

  const admin = createSupabaseAdminClient();
  const { data: userRow } = await admin
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .limit(1)
    .maybeSingle<UserOrgRow>();

  return {
    user,
    orgId: userRow?.organization_id ?? null,
  };
}

export async function GET() {
  try {
    const { user, orgId } = await getOrgIdForCurrentUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Organization not found" }, { status: 404 });
    }

    const admin = createSupabaseAdminClient();

    const { data, error } = await admin
      .from("scraper_config")
      .select("id,is_enabled,frequency,target_volume,filters,keywords")
      .eq("organization_id", orgId)
      .eq("scraper_type", "nctracks")
      .maybeSingle<ScraperConfigRow>();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({
        ok: true,
        config: {
          is_enabled: true,
          frequency: "daily",
          target_volume: 15,
          filters: DEFAULT_FILTERS,
          keywords: DEFAULT_KEYWORDS,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      config: {
        is_enabled: Boolean(data.is_enabled),
        frequency: data.frequency ?? "daily",
        target_volume: Number(data.target_volume ?? 15),
        filters: normalizeFilters(data.filters),
        keywords: normalizeStringArray(data.keywords ?? DEFAULT_KEYWORDS),
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, orgId } = await getOrgIdForCurrentUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Organization not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const frequencyRaw = String(body.frequency ?? "daily").trim().toLowerCase();
    const allowedFrequency = new Set(["hourly", "daily", "weekly"]);
    if (!allowedFrequency.has(frequencyRaw)) {
      return NextResponse.json({ ok: false, error: "Invalid frequency" }, { status: 400 });
    }

    const targetVolume = Number(body.target_volume ?? 15);
    if (!Number.isFinite(targetVolume) || targetVolume < 1 || targetVolume > 100) {
      return NextResponse.json({ ok: false, error: "Target volume must be between 1 and 100" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    const { error } = await admin
      .from("scraper_config")
      .upsert(
        {
          organization_id: orgId,
          scraper_type: "nctracks",
          is_enabled: Boolean(body.is_enabled ?? true),
          frequency: frequencyRaw,
          target_volume: targetVolume,
          filters: normalizeFilters(body.filters),
          keywords: normalizeStringArray(body.keywords ?? []),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,scraper_type" }
      );

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
