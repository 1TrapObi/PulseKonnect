import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { step1Schema } from "@/lib/validation/onboarding-schemas";

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
    const parsed = step1Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: parsed.error.issues?.[0]?.message ?? "Invalid payload",
      });
    }

    const admin = createSupabaseAdminClient();
    const orgId = await getOrgIdForUser(admin, user.id);
    if (!orgId) {
      return NextResponse.json({ success: false, error: "Missing organization" }, { status: 500 });
    }

    const serviceAreas = parsed.data.serviceAreas;

    const { error: orgErr } = await admin
      .from("organizations")
      .update({
        name: parsed.data.organizationName,
        contact_phone: parsed.data.phone,
        service_areas: serviceAreas,
        onboarding_step: 2,
      })
      .eq("id", orgId);

    if (orgErr) {
      return NextResponse.json({ success: false, error: orgErr.message }, { status: 500 });
    }

    const { error: profErr } = await admin
      .from("organization_profiles")
      .upsert(
        {
          organization_id: orgId,
          contact_name: parsed.data.contactName,
          contact_phone: parsed.data.phone,
          service_areas: serviceAreas,
          other_service_area: parsed.data.otherServiceArea ?? null,
        },
        { onConflict: "organization_id" }
      );

    if (profErr) {
      return NextResponse.json({ success: false, error: profErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, nextStep: "/onboarding/admin/step-2" });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
