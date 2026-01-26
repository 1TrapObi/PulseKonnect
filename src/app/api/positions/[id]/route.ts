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

const SELECT =
  "id,title,department,employment_type,num_openings,required_licenses,experience_level,required_specializations,preferred_specializations,salary_min,salary_max,pay_frequency,benefits,description,responsibilities,work_schedule,work_locations,application_deadline,status,internal_notes,posted_date,filled_date,created_by,created_at,updated_at";

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

    const { data: position, error } = await admin
      .from("positions")
      .select(SELECT)
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!position) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, position });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

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

    const { data: existing, error: exErr } = await admin
      .from("positions")
      .select(SELECT)
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (exErr) {
      return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const allow = [
      "title",
      "department",
      "employment_type",
      "num_openings",
      "required_licenses",
      "experience_level",
      "required_specializations",
      "preferred_specializations",
      "salary_min",
      "salary_max",
      "pay_frequency",
      "benefits",
      "description",
      "responsibilities",
      "work_schedule",
      "work_locations",
      "application_deadline",
      "status",
      "internal_notes",
      "posted_date",
      "filled_date",
    ];

    const patch: any = {};
    for (const k of allow) {
      if (k in body) patch[k] = (body as any)[k];
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ ok: true });
    }

    if (patch.salary_min != null && patch.salary_max != null) {
      const min = Number(patch.salary_min);
      const max = Number(patch.salary_max);
      if (!Number.isNaN(min) && !Number.isNaN(max) && min > max) {
        return NextResponse.json({ ok: false, error: "Salary min must be <= salary max" }, { status: 400 });
      }
    }

    const { error } = await admin
      .from("positions")
      .update(patch)
      .eq("id", id)
      .eq("organization_id", orgId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Re-match candidates (best effort)
    try {
      const { data: candidates } = await admin
        .from("candidates")
        .select("id,license_type,experience_level,experience_years,specializations,location")
        .eq("organization_id", orgId);

      const merged = { ...existing, ...patch } as any;

      const upserts = buildCandidatePositionMatchUpserts(candidates ?? [], {
        id: String(merged.id),
        required_licenses: Array.isArray(merged.required_licenses) ? merged.required_licenses : [],
        experience_level: String(merged.experience_level ?? "any"),
        required_specializations: merged.required_specializations,
        preferred_specializations: merged.preferred_specializations,
        work_locations: Array.isArray(merged.work_locations) ? merged.work_locations : [],
      });

      if (upserts.length) {
        await admin.from("candidate_position_matches").upsert(upserts, { onConflict: "candidate_id,position_id" });
      }
    } catch {
      // noop
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
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

    const { error } = await admin
      .from("positions")
      .update({ status: "closed" })
      .eq("id", id)
      .eq("organization_id", orgId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
