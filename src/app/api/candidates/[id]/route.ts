import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";

const CANDIDATE_SELECT =
  "id,name,email,phone,license_type,license_number,experience_years,experience_level,specializations,location,current_employer,resume_url,resume_text,source,source_url,status,fit_score,qualification_status,matched_positions,created_at,updated_at";

const CANDIDATE_SELECT_FALLBACK =
  "id,name,email,phone,license_type,license_number,experience_years,specializations,location,current_employer,resume_url,resume_text,source,source_url,status,fit_score,created_at,updated_at";

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

    // Candidate (schema tolerant)
    const q1 = await admin
      .from("candidates")
      .select(CANDIDATE_SELECT)
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle();

    let candidate: any = q1.data as any;
    if (q1.error) {
      const q2 = await admin
        .from("candidates")
        .select(CANDIDATE_SELECT_FALLBACK)
        .eq("id", id)
        .eq("organization_id", orgId)
        .maybeSingle();

      if (q2.error) {
        return NextResponse.json({ ok: false, error: q2.error.message }, { status: 500 });
      }
      candidate = q2.data as any;
    }

    if (!candidate) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    // Position matches (best-effort; positions table may not exist)
    let positionMatches: any[] = [];
    try {
      const { data: matches } = await admin
        .from("candidate_position_matches")
        .select("id,candidate_id,position_id,match_score,match_reasons,created_at")
        .eq("candidate_id", id)
        .order("match_score", { ascending: false });

      positionMatches = matches ?? [];

      const positionIds = Array.from(
        new Set(positionMatches.map((m: any) => String(m.position_id ?? "")).filter(Boolean))
      );

      if (positionIds.length) {
        const { data: positions } = await admin
          .from("positions")
          .select("id,title")
          .in("id", positionIds)
          .eq("organization_id", orgId);

        const titleById = new Map<string, string>();
        (positions ?? []).forEach((p: any) => titleById.set(String(p.id), String(p.title ?? p.id)));

        positionMatches = positionMatches.map((m: any) => ({
          ...m,
          position_title: titleById.get(String(m.position_id)) ?? null,
        }));
      }
    } catch {
      positionMatches = [];
    }

    return NextResponse.json({ ok: true, candidate, positionMatches });
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

    const patch: Record<string, any> = {};

    const allow = [
      "name",
      "email",
      "phone",
      "location",
      "current_employer",
      "license_type",
      "license_number",
      "experience_years",
      "resume_url",
      "resume_text",
      "specializations",
      "status",
    ];

    for (const k of allow) {
      if (k in body) patch[k] = (body as any)[k];
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ ok: true });
    }

    const { error } = await admin
      .from("candidates")
      .update(patch)
      .eq("id", id)
      .eq("organization_id", orgId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    await admin.from("activities").insert([
      {
        candidate_id: id,
        user_id: user.id,
        action: "candidate_profile_updated",
        notes: JSON.stringify({ fields: Object.keys(patch) }),
      },
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
