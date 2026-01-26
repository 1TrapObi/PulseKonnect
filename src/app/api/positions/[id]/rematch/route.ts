import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { buildCandidatePositionMatchUpserts } from "@/lib/matching/position-candidate-matcher";

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

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
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

    const { data: pos, error: posErr } = await admin
      .from("positions")
      .select("id,required_licenses,experience_level,required_specializations,preferred_specializations,work_locations")
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (posErr) {
      return NextResponse.json({ ok: false, error: posErr.message }, { status: 500 });
    }

    if (!pos) {
      return NextResponse.json({ ok: false, error: "Position not found" }, { status: 404 });
    }

    const { data: candidates } = await admin
      .from("candidates")
      .select("id,license_type,experience_level,experience_years,specializations,location")
      .eq("organization_id", orgId);

    const upserts = buildCandidatePositionMatchUpserts(candidates ?? [], {
      id: String((pos as any).id),
      required_licenses: Array.isArray((pos as any).required_licenses) ? (pos as any).required_licenses : [],
      experience_level: String((pos as any).experience_level ?? "any"),
      required_specializations: (pos as any).required_specializations,
      preferred_specializations: (pos as any).preferred_specializations,
      work_locations: Array.isArray((pos as any).work_locations) ? (pos as any).work_locations : [],
    });

    if (upserts.length) {
      await admin
        .from("candidate_position_matches")
        .upsert(upserts, { onConflict: "candidate_id,position_id" });
    }

    return NextResponse.json({ ok: true, updated: upserts.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
