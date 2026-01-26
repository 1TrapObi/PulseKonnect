import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { step4Schema } from "@/lib/validation/onboarding-schemas";

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

function mapPositionRow(row: any) {
  return {
    title: row?.title ?? "",
    requiredLicenses: (row?.required_licenses as any) ?? [],
    experienceLevel: (row?.experience_level as any) ?? "mid",
    employmentType: (row?.employment_type as any) ?? "full_time",
    specializations: (row?.required_specializations as any) ?? [],
    salaryMin: row?.salary_min != null ? Number(row.salary_min) : undefined,
    salaryMax: row?.salary_max != null ? Number(row.salary_max) : undefined,
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

    const admin = createSupabaseAdminClient();
    const orgId = await getOrgIdForUser(admin, user.id);
    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Missing organization" }, { status: 500 });
    }

    const { data: prefs, error: prefErr } = await admin
      .from("recruitment_preferences")
      .select("candidate_sources,hiring_volume")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (prefErr) {
      return NextResponse.json({ ok: false, error: prefErr.message }, { status: 500 });
    }

    const { data: positions, error: posErr } = await admin
      .from("positions")
      .select("title,required_licenses,experience_level,employment_type,required_specializations,salary_min,salary_max,internal_notes")
      .eq("organization_id", orgId)
      .eq("internal_notes", "onboarding_step4");

    if (posErr) {
      return NextResponse.json({ ok: false, error: posErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      skipPositions: (positions?.length ?? 0) === 0,
      positions: (positions ?? []).map(mapPositionRow),
      candidateSources: (prefs as any)?.candidate_sources ?? [],
      hiringVolume: (prefs as any)?.hiring_volume ?? "",
    });
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
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = step4Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues?.[0]?.message ?? "Invalid payload" });
    }

    const admin = createSupabaseAdminClient();
    const orgId = await getOrgIdForUser(admin, user.id);
    if (!orgId) {
      return NextResponse.json({ success: false, error: "Missing organization" }, { status: 500 });
    }

    const { error: delErr } = await admin
      .from("positions")
      .delete()
      .eq("organization_id", orgId)
      .eq("internal_notes", "onboarding_step4");

    if (delErr) {
      return NextResponse.json({ success: false, error: delErr.message }, { status: 500 });
    }

    if (!parsed.data.skipPositions) {
      const rows = (parsed.data.positions ?? []).map((p) => ({
        organization_id: orgId,
        title: p.title,
        employment_type: p.employmentType,
        required_licenses: p.requiredLicenses,
        experience_level: p.experienceLevel,
        required_specializations: p.specializations ?? [],
        salary_min: p.salaryMin ?? null,
        salary_max: p.salaryMax ?? null,
        description: "Onboarding position",
        work_locations: [],
        created_by: user.id,
        internal_notes: "onboarding_step4",
      }));

      if (rows.length > 0) {
        const { error: insErr } = await admin.from("positions").insert(rows);
        if (insErr) {
          return NextResponse.json({ success: false, error: insErr.message }, { status: 500 });
        }
      }
    }

    const { error: prefErr } = await admin
      .from("recruitment_preferences")
      .upsert(
        {
          organization_id: orgId,
          candidate_sources: parsed.data.candidateSources,
          hiring_volume: parsed.data.hiringVolume,
        },
        { onConflict: "organization_id" }
      );

    if (prefErr) {
      return NextResponse.json({ success: false, error: prefErr.message }, { status: 500 });
    }

    const { error: orgErr } = await admin
      .from("organizations")
      .update({ onboarding_step: 5 })
      .eq("id", orgId);

    if (orgErr) {
      return NextResponse.json({ success: false, error: orgErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, nextStep: "/onboarding/admin/step-5" });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
