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

    const { data: sources, error } = await admin
      .from("lead_sources")
      .select("id,organization_id,is_active,is_enabled,leads_this_week,conversion_rate,avg_score")
      .eq("is_active", true)
      .or(`organization_id.is.null,organization_id.eq.${orgId}`);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const scoped = (sources ?? []).filter((s: any) => {
      const ownerOrgId = s?.organization_id ? String(s.organization_id) : null;
      return !ownerOrgId || ownerOrgId === orgId;
    });

    const totalSources = scoped.length;
    const enabledSources = scoped.filter((s: any) => Boolean(s?.is_enabled ?? true)).length;

    const sumLeadsThisWeek = scoped.reduce((acc: number, s: any) => acc + Number(s?.leads_this_week ?? 0), 0);

    const avgConversionRate = scoped.length
      ? scoped.reduce((acc: number, s: any) => acc + Number(s?.conversion_rate ?? 0), 0) / scoped.length
      : 0;

    const avgScore = scoped.length
      ? scoped.reduce((acc: number, s: any) => acc + Number(s?.avg_score ?? 0), 0) / scoped.length
      : 0;

    return NextResponse.json({
      ok: true,
      totalSources,
      enabledSources,
      leadsThisWeek: sumLeadsThisWeek,
      avgConversionRate,
      avgScore,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
