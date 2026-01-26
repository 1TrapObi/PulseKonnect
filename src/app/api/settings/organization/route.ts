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
      .select("name,contact_phone,service_areas")
      .eq("id", orgId)
      .maybeSingle();

    if (orgErr) {
      return NextResponse.json({ ok: false, error: orgErr.message }, { status: 500 });
    }

    const { data: profile, error: profErr } = await admin
      .from("organization_profiles")
      .select(
        "contact_name,contact_phone,service_areas,other_service_area,service_types,other_service_type,age_groups,insurance_types,other_insurance_type"
      )
      .eq("organization_id", orgId)
      .maybeSingle();

    if (profErr) {
      return NextResponse.json({ ok: false, error: profErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      organization: {
        organizationName: String((org as any)?.name ?? ""),
        contactName: String((profile as any)?.contact_name ?? ""),
        phone: String((profile as any)?.contact_phone ?? (org as any)?.contact_phone ?? ""),
        serviceAreas: ((profile as any)?.service_areas ?? (org as any)?.service_areas ?? []) as any,
        otherServiceArea: String((profile as any)?.other_service_area ?? ""),
        serviceTypes: ((profile as any)?.service_types ?? []) as any,
        otherServiceType: String((profile as any)?.other_service_type ?? ""),
        ageGroups: ((profile as any)?.age_groups ?? []) as any,
        insuranceTypes: ((profile as any)?.insurance_types ?? []) as any,
        otherInsuranceType: String((profile as any)?.other_insurance_type ?? ""),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));

    const organizationName = String((body as any).organizationName ?? "").trim();
    const contactName = String((body as any).contactName ?? "").trim();
    const phone = String((body as any).phone ?? "").trim();

    const serviceAreas = Array.isArray((body as any).serviceAreas)
      ? (body as any).serviceAreas.map((x: any) => String(x)).filter(Boolean)
      : [];

    const otherServiceArea = String((body as any).otherServiceArea ?? "").trim();

    const serviceTypes = Array.isArray((body as any).serviceTypes)
      ? (body as any).serviceTypes.map((x: any) => String(x)).filter(Boolean)
      : [];

    const otherServiceType = String((body as any).otherServiceType ?? "").trim();

    const ageGroups = Array.isArray((body as any).ageGroups)
      ? (body as any).ageGroups.map((x: any) => String(x)).filter(Boolean)
      : [];

    const insuranceTypes = Array.isArray((body as any).insuranceTypes)
      ? (body as any).insuranceTypes.map((x: any) => String(x)).filter(Boolean)
      : [];

    const otherInsuranceType = String((body as any).otherInsuranceType ?? "").trim();

    if (!organizationName || organizationName.length < 2) {
      return NextResponse.json({ ok: false, error: "Organization name is required" }, { status: 400 });
    }
    if (!contactName || contactName.length < 2) {
      return NextResponse.json({ ok: false, error: "Primary contact name is required" }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ ok: false, error: "Phone number is required" }, { status: 400 });
    }
    if (!serviceAreas.length) {
      return NextResponse.json({ ok: false, error: "Select at least one service area" }, { status: 400 });
    }
    if (!serviceTypes.length) {
      return NextResponse.json({ ok: false, error: "Select at least one service type" }, { status: 400 });
    }
    if (serviceTypes.includes("Other") && !otherServiceType) {
      return NextResponse.json({ ok: false, error: "Please specify the other service type" }, { status: 400 });
    }
    if (!ageGroups.length) {
      return NextResponse.json({ ok: false, error: "Select at least one age group" }, { status: 400 });
    }
    if (!insuranceTypes.length) {
      return NextResponse.json({ ok: false, error: "Select at least one insurance type" }, { status: 400 });
    }
    if (insuranceTypes.includes("Other") && !otherInsuranceType) {
      return NextResponse.json({ ok: false, error: "Please specify the other insurance type" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const orgId = await getOrgIdForUser(admin, user.id);
    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Missing organization" }, { status: 500 });
    }

    const { error: orgErr } = await admin
      .from("organizations")
      .update({
        name: organizationName,
        contact_phone: phone,
        service_areas: serviceAreas,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", orgId);

    if (orgErr) {
      return NextResponse.json({ ok: false, error: orgErr.message }, { status: 500 });
    }

    const { error: profErr } = await admin
      .from("organization_profiles")
      .upsert(
        {
          organization_id: orgId,
          contact_name: contactName,
          contact_phone: phone,
          service_areas: serviceAreas,
          other_service_area: otherServiceArea || null,
          service_types: serviceTypes,
          other_service_type: otherServiceType || null,
          age_groups: ageGroups,
          insurance_types: insuranceTypes,
          other_insurance_type: otherInsuranceType || null,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "organization_id" }
      );

    if (profErr) {
      return NextResponse.json({ ok: false, error: profErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
