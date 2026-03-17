import { NextResponse } from "next/server";

import { NCTracksScraper, type ScraperFilters } from "@/lib/scrapers/nctracks-scraper";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";

type UserOrgRow = {
  organization_id: string | null;
};

type ScraperConfigRow = {
  is_enabled: boolean;
  frequency: "hourly" | "daily" | "weekly";
  target_volume: number;
  filters: ScraperFilters | null;
  keywords: string[] | null;
};

const DEFAULT_FILTERS: ScraperFilters = {
  counties: ["Durham", "Wake", "Cumberland"],
  serviceTypes: ["Mental Health", "Behavioral Health", "Substance Abuse"],
  insuranceProviders: ["Alliance", "AmeriHealth", "Carolina Complete"],
};

const DEFAULT_KEYWORDS = ["PTSD", "substance abuse", "counseling", "therapy"];

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeFilters(value: unknown): ScraperFilters {
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

export async function POST() {
  try {
    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();

    const { data: userRow } = await admin
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .limit(1)
      .maybeSingle<UserOrgRow>();

    const orgId = userRow?.organization_id ?? null;

    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Organization not found" }, { status: 404 });
    }

    const { data: config } = await admin
      .from("scraper_config")
      .select("is_enabled,frequency,target_volume,filters,keywords")
      .eq("organization_id", orgId)
      .eq("scraper_type", "nctracks")
      .maybeSingle<ScraperConfigRow>();

    const isEnabled = config?.is_enabled ?? true;
    if (!isEnabled) {
      return NextResponse.json({ ok: false, error: "NCTracks scraper is disabled" }, { status: 400 });
    }

    if (!config) {
      await admin.from("scraper_config").upsert(
        {
          organization_id: orgId,
          scraper_type: "nctracks",
          is_enabled: true,
          frequency: "daily",
          target_volume: 15,
          filters: DEFAULT_FILTERS,
          keywords: DEFAULT_KEYWORDS,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,scraper_type" }
      );
    }

    const scraper = new NCTracksScraper();
    const result = await scraper.run({
      organizationId: orgId,
      filters: normalizeFilters(config?.filters),
      keywords: normalizeStringArray(config?.keywords ?? DEFAULT_KEYWORDS),
      targetVolume: Number(config?.target_volume ?? 15),
    });

    return NextResponse.json({ ok: true, result });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
