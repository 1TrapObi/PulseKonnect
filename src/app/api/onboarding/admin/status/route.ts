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

    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .select("onboarding_step,onboarding_completed,name,contact_phone,service_areas")
      .eq("id", orgId)
      .maybeSingle();

    if (orgErr) {
      return NextResponse.json({ ok: false, error: orgErr.message }, { status: 500 });
    }

    const { data: profile } = await admin
      .from("organization_profiles")
      .select(
        "contact_name,contact_phone,service_areas,other_service_area,service_types,other_service_type,age_groups,insurance_types,other_insurance_type"
      )
      .eq("organization_id", orgId)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      currentStep: Number((org as any)?.onboarding_step ?? 1),
      onboardingCompleted: Boolean((org as any)?.onboarding_completed),
      organizationProfile: {
        organizationName: (org as any)?.name ?? "",
        contactName: (profile as any)?.contact_name ?? "",
        phone: (profile as any)?.contact_phone ?? (org as any)?.contact_phone ?? "",
        serviceAreas: (profile as any)?.service_areas ?? (org as any)?.service_areas ?? [],
        otherServiceArea: (profile as any)?.other_service_area ?? "",
        serviceTypes: (profile as any)?.service_types ?? [],
        otherServiceType: (profile as any)?.other_service_type ?? "",
        ageGroups: (profile as any)?.age_groups ?? [],
        insuranceTypes: (profile as any)?.insurance_types ?? [],
        otherInsuranceType: (profile as any)?.other_insurance_type ?? "",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
