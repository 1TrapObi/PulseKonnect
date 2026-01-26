import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { buildCandidatePositionMatchUpserts } from "@/lib/matching/position-candidate-matcher";

function asOptionalString(v: string | null) {
  const s = (v ?? "").trim();
  return s ? s : null;
}

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

function normalizeStatus(v: string | null) {
  const s = (v ?? "").trim().toLowerCase();
  return s || null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = normalizeStatus(url.searchParams.get("status"));
    const department = asOptionalString(url.searchParams.get("department"));
    const search = asOptionalString(url.searchParams.get("search"));

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

    let q = admin
      .from("positions")
      .select(
        "id,title,department,employment_type,num_openings,required_licenses,experience_level,required_specializations,preferred_specializations,salary_min,salary_max,pay_frequency,benefits,description,responsibilities,work_schedule,work_locations,application_deadline,status,internal_notes,posted_date,filled_date,created_by,created_at,updated_at",
        { count: "exact" }
      )
      .eq("organization_id", orgId)
      .order("posted_date", { ascending: false });

    if (status && status !== "all") q = q.eq("status", status);
    if (department && department !== "all") q = q.eq("department", department);

    if (search) {
      const s = search.replaceAll("%", "");
      q = q.or(`title.ilike.%${s}%,department.ilike.%${s}%`);
    }

    const { data, error, count } = await q;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, positions: data ?? [], count: count ?? 0 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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

    const title = String(body.title ?? "").trim();
    const employmentType = String(body.employment_type ?? "").trim();
    const status = String(body.status ?? "active").trim().toLowerCase();
    const requiredLicenses = Array.isArray(body.required_licenses) ? body.required_licenses : [];
    const experienceLevel = String(body.experience_level ?? "").trim().toLowerCase();
    const workLocations = Array.isArray(body.work_locations) ? body.work_locations : [];
    const description = String(body.description ?? "").trim();

    if (!title) {
      return NextResponse.json({ ok: false, error: "Title required" }, { status: 400 });
    }
    if (!employmentType) {
      return NextResponse.json({ ok: false, error: "Employment type required" }, { status: 400 });
    }
    if (!requiredLicenses.length) {
      return NextResponse.json({ ok: false, error: "At least 1 required license" }, { status: 400 });
    }
    if (!experienceLevel) {
      return NextResponse.json({ ok: false, error: "Experience level required" }, { status: 400 });
    }
    if (!workLocations.length) {
      return NextResponse.json({ ok: false, error: "At least 1 work location required" }, { status: 400 });
    }
    if (!description || description.length < 100) {
      return NextResponse.json(
        { ok: false, error: "Job description required (min 100 characters)" },
        { status: 400 }
      );
    }

    const row: any = {
      organization_id: orgId,
      title,
      department: body.department ?? null,
      employment_type: employmentType,
      num_openings: typeof body.num_openings === "number" ? body.num_openings : 1,
      required_licenses: requiredLicenses,
      experience_level: experienceLevel,
      required_specializations: body.required_specializations ?? null,
      preferred_specializations: body.preferred_specializations ?? null,
      salary_min: body.salary_min ?? null,
      salary_max: body.salary_max ?? null,
      pay_frequency: body.pay_frequency ?? null,
      benefits: body.benefits ?? null,
      description,
      responsibilities: body.responsibilities ?? null,
      work_schedule: body.work_schedule ?? null,
      work_locations: workLocations,
      application_deadline: body.application_deadline ?? null,
      status,
      internal_notes: body.internal_notes ?? null,
      posted_date: body.posted_date ?? null,
      created_by: user.id,
    };

    if (row.salary_min != null && row.salary_max != null) {
      const min = Number(row.salary_min);
      const max = Number(row.salary_max);
      if (!Number.isNaN(min) && !Number.isNaN(max) && min > max) {
        return NextResponse.json({ ok: false, error: "Salary min must be <= salary max" }, { status: 400 });
      }
    }

    const { data: pos, error } = await admin
      .from("positions")
      .insert([row])
      .select(
        "id,title,department,employment_type,num_openings,required_licenses,experience_level,required_specializations,preferred_specializations,salary_min,salary_max,pay_frequency,benefits,description,responsibilities,work_schedule,work_locations,application_deadline,status,internal_notes,posted_date,filled_date,created_by,created_at,updated_at"
      )
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Trigger candidate matching (best effort)
    try {
      const { data: candidates } = await admin
        .from("candidates")
        .select("id,license_type,experience_level,experience_years,specializations,location")
        .eq("organization_id", orgId);

      if (pos && candidates?.length) {
        const upserts = buildCandidatePositionMatchUpserts(candidates as any, {
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
      }
    } catch {
      // noop
    }

    return NextResponse.json({ ok: true, position: pos });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
