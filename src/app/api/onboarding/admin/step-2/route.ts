import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { step2Schema } from "@/lib/validation/onboarding-schemas";

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

    const { data: profile, error } = await admin
      .from("organization_profiles")
      .select("service_types,other_service_type,age_groups,insurance_types,other_insurance_type")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      serviceTypes: (profile as any)?.service_types ?? [],
      otherServiceType: (profile as any)?.other_service_type ?? "",
      ageGroups: (profile as any)?.age_groups ?? [],
      insuranceTypes: (profile as any)?.insurance_types ?? [],
      otherInsuranceType: (profile as any)?.other_insurance_type ?? "",
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
    const parsed = step2Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues?.[0]?.message ?? "Invalid payload" });
    }

    const admin = createSupabaseAdminClient();
    const orgId = await getOrgIdForUser(admin, user.id);
    if (!orgId) {
      return NextResponse.json({ success: false, error: "Missing organization" }, { status: 500 });
    }

    const { data: existingProfile, error: existingProfileErr } = await admin
      .from("organization_profiles")
      .select("service_areas")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (existingProfileErr) {
      return NextResponse.json({ success: false, error: existingProfileErr.message }, { status: 500 });
    }

    let serviceAreas = (existingProfile as any)?.service_areas as string[] | null | undefined;
    if (!serviceAreas || serviceAreas.length === 0) {
      const { data: orgRow, error: orgRowErr } = await admin
        .from("organizations")
        .select("service_areas")
        .eq("id", orgId)
        .maybeSingle();

      if (orgRowErr) {
        return NextResponse.json({ success: false, error: orgRowErr.message }, { status: 500 });
      }

      serviceAreas = ((orgRow as any)?.service_areas as string[] | null | undefined) ?? [];
    }

    const { error: orgErr } = await admin
      .from("organizations")
      .update({ onboarding_step: 3 })
      .eq("id", orgId);

    if (orgErr) {
      return NextResponse.json({ success: false, error: orgErr.message }, { status: 500 });
    }

    const { error: profErr } = await admin
      .from("organization_profiles")
      .upsert(
        {
          organization_id: orgId,
          service_areas: serviceAreas ?? [],
          service_types: parsed.data.serviceTypes,
          other_service_type: parsed.data.otherServiceType ?? null,
          age_groups: parsed.data.ageGroups,
          insurance_types: parsed.data.insuranceTypes,
          other_insurance_type: parsed.data.otherInsuranceType ?? null,
        },
        { onConflict: "organization_id" }
      );

    if (profErr) {
      return NextResponse.json({ success: false, error: profErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, nextStep: "/onboarding/admin/step-3" });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
