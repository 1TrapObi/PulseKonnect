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

function normalizeSources(input: any): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((x) => String(x)).map((x) => x.trim()).filter(Boolean);
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
      .from("recruitment_preferences")
      .select("candidate_sources,hiring_volume")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      settings: {
        candidateSources: normalizeSources((prefs as any)?.candidate_sources ?? []),
        hiringVolume: String((prefs as any)?.hiring_volume ?? ""),
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

    const candidateSources = normalizeSources((body as any)?.candidateSources ?? (body as any)?.candidate_sources ?? []);
    const hiringVolume = String((body as any)?.hiringVolume ?? (body as any)?.hiring_volume ?? "").trim();

    if (!candidateSources.length) {
      return NextResponse.json({ ok: false, error: "Select at least one candidate source" }, { status: 400 });
    }

    if (!hiringVolume) {
      return NextResponse.json({ ok: false, error: "Expected hiring volume is required" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const orgId = await getOrgIdForUser(admin, user.id);
    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Missing organization" }, { status: 500 });
    }

    const { error } = await admin
      .from("recruitment_preferences")
      .upsert(
        {
          organization_id: orgId,
          candidate_sources: candidateSources as any,
          hiring_volume: hiringVolume,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "organization_id" }
      );

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
