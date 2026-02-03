import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { getOrgIdForUser } from "@/lib/api/org";

const DAILY_LIMIT = 3;

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function startOfTomorrowUtcIso() {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  return tomorrow.toISOString();
}

function buildStubLead(sourceName: string, idx: number) {
  const safe = sourceName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return {
    name: `Test Lead ${idx + 1} (${sourceName})`,
    email: `test-${idx + 1}@${safe || "source"}.example`,
    phone: null,
    location: null,
    source: sourceName,
    source_url: null,
    raw_data: {
      test: true,
      source: sourceName,
      idx,
    },
  };
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

    const orgId = await getOrgIdForUser(user.id);
    const admin = createSupabaseAdminClient();

    const body = (await request.json().catch(() => ({}))) as any;
    const requestedSourceIds = Array.isArray(body?.sourceIds)
      ? (body.sourceIds as any[]).map((x) => String(x)).filter(Boolean)
      : null;

    const testAllEnabled = Boolean(body?.testAllEnabled ?? true);

    const today = todayIsoDate();

    const { data: usageExisting, error: usageGetErr } = await admin
      .from("lead_source_test_usage")
      .select("id,test_count")
      .eq("organization_id", orgId)
      .eq("test_date", today)
      .maybeSingle();

    if (usageGetErr) {
      return NextResponse.json({ ok: false, error: usageGetErr.message }, { status: 500 });
    }

    const used = Number((usageExisting as any)?.test_count ?? 0);
    if (used >= DAILY_LIMIT) {
      return NextResponse.json(
        {
          ok: false,
          error: "Daily test limit reached",
          dailyLimit: DAILY_LIMIT,
          used,
          remaining: 0,
          resetAt: startOfTomorrowUtcIso(),
        },
        { status: 429 }
      );
    }

    const sourceQuery = admin
      .from("lead_sources")
      .select("id,organization_id,parent_source_id,name,source_type,base_url,is_active,is_enabled")
      .eq("is_active", true)
      .or(`organization_id.is.null,organization_id.eq.${orgId}`);

    const { data: sources, error: srcErr } = requestedSourceIds
      ? await sourceQuery.in("id", requestedSourceIds)
      : await sourceQuery;

    if (srcErr) {
      return NextResponse.json({ ok: false, error: srcErr.message }, { status: 500 });
    }

    const rows = (sources ?? []) as any[];

    // Prefer org override rows when present for a given global source.
    const overridesByParent = new Map<string, any>();
    for (const r of rows) {
      const parentId = r?.parent_source_id ? String(r.parent_source_id) : null;
      const ownerOrgId = r?.organization_id ? String(r.organization_id) : null;
      if (parentId && ownerOrgId === orgId) {
        overridesByParent.set(parentId, r);
      }
    }

    const effective: any[] = [];
    for (const r of rows) {
      const ownerOrgId = r?.organization_id ? String(r.organization_id) : null;
      const parentId = r?.parent_source_id ? String(r.parent_source_id) : null;

      if (ownerOrgId === orgId) {
        effective.push(r);
        continue;
      }

      // For global sources (org_id null, parent_id null), include only if there isn't an override.
      if (!ownerOrgId && !parentId) {
        const override = overridesByParent.get(String(r.id));
        if (!override) effective.push(r);
      }
    }

    const filtered = requestedSourceIds
      ? effective
      : testAllEnabled
      ? effective.filter((s: any) => Boolean(s?.is_enabled ?? true))
      : effective;

    if (filtered.length === 0) {
      return NextResponse.json({ ok: false, error: "No sources to test" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    if ((usageExisting as any)?.id) {
      const { error: updUsageErr } = await admin
        .from("lead_source_test_usage")
        .update({
          test_count: used + 1,
          last_test_at: nowIso,
          reset_at: startOfTomorrowUtcIso(),
          updated_at: nowIso,
        } as any)
        .eq("id", (usageExisting as any).id);

      if (updUsageErr) {
        return NextResponse.json({ ok: false, error: updUsageErr.message }, { status: 500 });
      }
    } else {
      const { error: insUsageErr } = await admin.from("lead_source_test_usage").insert({
        organization_id: orgId,
        user_id: user.id,
        test_count: 1,
        last_test_at: nowIso,
        reset_at: startOfTomorrowUtcIso(),
        test_date: today,
        created_at: nowIso,
        updated_at: nowIso,
      } as any);

      if (insUsageErr) {
        return NextResponse.json({ ok: false, error: insUsageErr.message }, { status: 500 });
      }
    }

    const results: any[] = [];

    for (const src of filtered) {
      const sourceId = String((src as any).id);
      const sourceName = String((src as any).name ?? "Source");

      const leadsFound = Math.min(3, Math.max(1, sourceName.length % 3 || 1));
      const leads = Array.from({ length: leadsFound }).map((_, i) => buildStubLead(sourceName, i));

      const startedAt = Date.now();
      const durationMs = Date.now() - startedAt;

      const { data: created, error: insErr } = await admin
        .from("lead_source_test_results")
        .insert({
          organization_id: orgId,
          source_id: sourceId,
          user_id: user.id,
          test_type: "manual",
          leads_found: leadsFound,
          test_leads: leads as any,
          test_duration_ms: durationMs,
          success: true,
          error_message: null,
        } as any)
        .select("id,created_at")
        .maybeSingle();

      if (insErr) {
        results.push({ sourceId, sourceName, ok: false, error: insErr.message, leadsFound: 0, leads: [] });
        continue;
      }

      await admin
        .from("lead_sources")
        .update({ last_scan_at: nowIso, updated_at: nowIso } as any)
        .eq("id", sourceId);

      results.push({
        id: created?.id ?? null,
        createdAt: (created as any)?.created_at ?? null,
        sourceId,
        sourceName,
        ok: true,
        leadsFound,
        leads,
      });
    }

    const newUsed = used + 1;

    return NextResponse.json({
      ok: true,
      dailyLimit: DAILY_LIMIT,
      used: newUsed,
      remaining: Math.max(0, DAILY_LIMIT - newUsed),
      resetAt: startOfTomorrowUtcIso(),
      results,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
