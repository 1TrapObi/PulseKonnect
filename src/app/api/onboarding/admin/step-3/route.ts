import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { step3Schema } from "@/lib/validation/onboarding-schemas";

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

    const { data: prefs, error } = await admin
      .from("lead_preferences")
      .select("lead_sources,volume_goal,assignment_method,email_high_priority,daily_digest,weekly_report")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      leadSources: (prefs as any)?.lead_sources ?? [],
      volumeGoal: (prefs as any)?.volume_goal ?? "medium",
      assignmentMethod: (prefs as any)?.assignment_method ?? "manual",
      emailHighPriority: Boolean((prefs as any)?.email_high_priority ?? true),
      dailyDigest: Boolean((prefs as any)?.daily_digest ?? false),
      weeklyReport: Boolean((prefs as any)?.weekly_report ?? true),
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
    const parsed = step3Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues?.[0]?.message ?? "Invalid payload" });
    }

    const admin = createSupabaseAdminClient();
    const orgId = await getOrgIdForUser(admin, user.id);
    if (!orgId) {
      return NextResponse.json({ success: false, error: "Missing organization" }, { status: 500 });
    }

    const { error: prefErr } = await admin
      .from("lead_preferences")
      .upsert(
        {
          organization_id: orgId,
          lead_sources: parsed.data.leadSources,
          volume_goal: parsed.data.volumeGoal,
          assignment_method: parsed.data.assignmentMethod,
          email_high_priority: parsed.data.emailHighPriority,
          daily_digest: parsed.data.dailyDigest,
          weekly_report: parsed.data.weeklyReport,
        },
        { onConflict: "organization_id" }
      );

    if (prefErr) {
      return NextResponse.json({ success: false, error: prefErr.message }, { status: 500 });
    }

    const { error: orgErr } = await admin
      .from("organizations")
      .update({ onboarding_step: 4 })
      .eq("id", orgId);

    if (orgErr) {
      return NextResponse.json({ success: false, error: orgErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, nextStep: "/onboarding/admin/step-4" });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
