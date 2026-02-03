import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { getOrgIdForUser } from "@/lib/api/org";

function mapLeadSourceRow(row: any) {
  return {
    id: String(row?.id ?? ""),
    organizationId: row?.organization_id ? String(row.organization_id) : null,
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
        "id,organization_id,name,source_type,base_url,is_active,is_enabled,scan_frequency,leads_this_week,conversion_rate,avg_score,last_scan_at,next_scan_at,run_frequency,priority,urls,search_parameters,max_results_per_run,dedup_window_days,auto_qualify,auto_reject_below_score,created_at,updated_at"
      )
      .eq("is_active", true)
      .or(`organization_id.is.null,organization_id.eq.${orgId}`)
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, sources: (data ?? []).map(mapLeadSourceRow) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
