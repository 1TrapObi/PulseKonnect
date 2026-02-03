import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { getOrgIdForUser } from "@/lib/api/org";

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

    const startOfMonthIso = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1, 0, 0, 0, 0)).toISOString();

    const [{ count: totalLeads }, { count: leadsThisMonth }] = await Promise.all([
      admin
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId),
      admin
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .gte("created_at", startOfMonthIso),
    ]);

    const { data: sources, error } = await admin
      .from("lead_sources")
      .select("id,organization_id,parent_source_id,is_active,is_enabled,leads_this_week,conversion_rate,avg_score,last_scan_at,name")
      .eq("is_active", true)
      .or(`organization_id.is.null,organization_id.eq.${orgId}`);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
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

    const scoped: any[] = [];
    for (const r of rows) {
      const ownerOrgId = r?.organization_id ? String(r.organization_id) : null;
      const parentId = r?.parent_source_id ? String(r.parent_source_id) : null;

      if (ownerOrgId === orgId) {
        scoped.push(r);
        continue;
      }

      if (!ownerOrgId && !parentId) {
        const override = overridesByParent.get(String(r.id));
        if (!override) scoped.push(r);
      }
    }

    const totalSources = scoped.length;
    const enabledSources = scoped.filter((s: any) => Boolean(s?.is_enabled ?? true)).length;

    const sumLeadsThisWeek = scoped.reduce((acc: number, s: any) => acc + Number(s?.leads_this_week ?? 0), 0);

    const avgConversionRate = scoped.length
      ? scoped.reduce((acc: number, s: any) => acc + Number(s?.conversion_rate ?? 0), 0) / scoped.length
      : 0;

    const avgScore = scoped.length
      ? scoped.reduce((acc: number, s: any) => acc + Number(s?.avg_score ?? 0), 0) / scoped.length
      : 0;

    let bestSource: { id: string; name: string; leadsThisWeek: number } | null = null;
    for (const s of scoped) {
      const leads = Number(s?.leads_this_week ?? 0);
      if (!bestSource || leads > bestSource.leadsThisWeek) {
        bestSource = {
          id: String(s?.id ?? ""),
          name: String(s?.name ?? ""),
          leadsThisWeek: leads,
        };
      }
    }

    const lastScanAt = scoped
      .map((s: any) => (s?.last_scan_at ? String(s.last_scan_at) : null))
      .filter(Boolean)
      .sort()
      .slice(-1)[0] ?? null;

    const { data: lastRun } = await admin
      .from("scraper_runs")
      .select("status,started_at,completed_at,error_message")
      .eq("organization_id", orgId)
      .eq("source_type", "lead")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      totalSources,
      enabledSources,
      totalLeads: totalLeads ?? 0,
      leadsThisMonth: leadsThisMonth ?? 0,
      leadsThisWeek: sumLeadsThisWeek,
      avgConversionRate,
      avgScore,
      bestSource,
      lastScanAt,
      lastRun: lastRun
        ? {
            status: String((lastRun as any).status ?? ""),
            startedAt: (lastRun as any).started_at ?? null,
            completedAt: (lastRun as any).completed_at ?? null,
            errorMessage: (lastRun as any).error_message ?? null,
          }
        : null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
