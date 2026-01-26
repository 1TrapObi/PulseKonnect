import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";

async function getOrgIdForUser(admin: any, userId: string) {
  const { data: userRow, error } = await admin
    .from("users")
    .select("organization_id")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();

  if (error || !userRow?.organization_id) return null;
  return userRow.organization_id as string;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const orgId = await getOrgIdForUser(admin, user.id);
    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Missing organization" }, { status: 500 });
    }

    const { data: positionRow } = await admin
      .from("positions")
      .select("id")
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!positionRow) {
      return NextResponse.json({ ok: false, error: "Position not found" }, { status: 404 });
    }

    const { data: matches, error } = await admin
      .from("candidate_position_matches")
      .select("candidate_id,position_id,match_score,match_reasons,created_at")
      .eq("position_id", id)
      .order("match_score", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const candidateIds = Array.from(new Set((matches ?? []).map((m: any) => String(m.candidate_id ?? "")).filter(Boolean)));

    let candidates: any[] = [];
    if (candidateIds.length) {
      const { data: c } = await admin
        .from("candidates")
        .select("id,name,email,phone,license_type,experience_years,experience_level,specializations,location,status,fit_score")
        .in("id", candidateIds)
        .eq("organization_id", orgId);
      candidates = c ?? [];
    }

    const candById = new Map<string, any>();
    candidates.forEach((c) => candById.set(String(c.id), c));

    const rows = (matches ?? []).map((m: any) => ({
      ...m,
      candidate: candById.get(String(m.candidate_id)) ?? null,
    }));

    return NextResponse.json({ ok: true, matches: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
