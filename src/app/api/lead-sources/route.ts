import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { getOrgIdForUser } from "@/lib/api/org";

function mapLeadSourceRow(row: any) {
  return {
    id: String(row?.id ?? ""),
    organizationId: row?.organization_id ? String(row.organization_id) : null,
    parentSourceId: row?.parent_source_id ? String(row.parent_source_id) : null,
    name: String(row?.name ?? ""),
    sourceType: String(row?.source_type ?? ""),
    baseUrl: row?.base_url ?? null,
    isActive: Boolean(row?.is_active ?? true),
    isEnabled: Boolean(row?.is_enabled ?? true),
    scanFrequency: String(row?.scan_frequency ?? ""),
    leadsThisWeek: Number(row?.leads_this_week ?? 0),
    conversionRate: Number(row?.conversion_rate ?? 0),
    avgScore: Number(row?.avg_score ?? 0),
    lastScanAt: row?.last_scan_at ?? null,
    nextScanAt: row?.next_scan_at ?? null,
    runFrequency: row?.run_frequency ?? null,
    priority: row?.priority ?? null,
    urls: row?.urls ?? null,
    searchParameters: row?.search_parameters ?? null,
    maxResultsPerRun: row?.max_results_per_run ?? null,
    dedupWindowDays: row?.dedup_window_days ?? null,
    autoQualify: row?.auto_qualify ?? null,
    autoRejectBelowScore: row?.auto_reject_below_score ?? null,
    createdAt: row?.created_at ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

export async function GET() {
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
    const { data, error } = await admin
      .from("lead_sources")
      .select(
        "id,organization_id,parent_source_id,name,source_type,base_url,is_active,is_enabled,scan_frequency,leads_this_week,conversion_rate,avg_score,last_scan_at,next_scan_at,run_frequency,priority,urls,search_parameters,max_results_per_run,dedup_window_days,auto_qualify,auto_reject_below_score,created_at,updated_at"
      )
      .eq("is_active", true)
      .or(`organization_id.is.null,organization_id.eq.${orgId}`)
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as any[];

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

      // Include org-owned sources (including overrides) directly.
      if (ownerOrgId === orgId) {
        effective.push(r);
        continue;
      }

      // For global sources (org_id null, parent_id null), include only if there isn't an override.
      if (!ownerOrgId && !parentId) {
        const override = overridesByParent.get(String(r.id));
        if (!override) {
          effective.push(r);
        }
      }
    }

    return NextResponse.json({ ok: true, sources: effective.map(mapLeadSourceRow) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
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

    const body = (await request.json().catch(() => ({}))) as any;

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const sourceType = typeof body?.sourceType === "string" ? body.sourceType.trim() : "";
    const baseUrl = typeof body?.baseUrl === "string" ? body.baseUrl.trim() : null;
    const scanFrequency = typeof body?.scanFrequency === "string" ? body.scanFrequency.trim() : null;

    if (!name) {
      return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
    }
    if (!sourceType) {
      return NextResponse.json({ ok: false, error: "sourceType is required" }, { status: 400 });
    }

    const orgId = await getOrgIdForUser(user.id);
    const admin = createSupabaseAdminClient();
    const nowIso = new Date().toISOString();

    const { data: created, error } = await admin
      .from("lead_sources")
      .insert({
        organization_id: orgId,
        parent_source_id: null,
        name,
        source_type: sourceType,
        base_url: baseUrl,
        is_active: true,
        is_enabled: true,
        scan_frequency: scanFrequency ?? "Every 4 hours",
        created_at: nowIso,
        updated_at: nowIso,
      } as any)
      .select(
        "id,organization_id,parent_source_id,name,source_type,base_url,is_active,is_enabled,scan_frequency,leads_this_week,conversion_rate,avg_score,last_scan_at,next_scan_at,run_frequency,priority,urls,search_parameters,max_results_per_run,dedup_window_days,auto_qualify,auto_reject_below_score,created_at,updated_at"
      )
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, source: mapLeadSourceRow(created) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
