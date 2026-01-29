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

function normalizeLeadSources(input: any): { source: string; priority: "high" | "medium" | "low" | null }[] {
  if (!Array.isArray(input)) return [];
  const out: { source: string; priority: "high" | "medium" | "low" | null }[] = [];
  for (const raw of input) {
    const source = String((raw as any)?.source ?? "").trim();
    if (!source) continue;
    const pRaw = (raw as any)?.priority;
    const priority = pRaw === "high" || pRaw === "medium" || pRaw === "low" ? pRaw : null;
    out.push({ source, priority });
  }
  return out;
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
      .select("lead_sources,volume_goal,assignment_method")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      settings: {
        leadSources: normalizeLeadSources((prefs as any)?.lead_sources ?? []),
        volumeGoal: String((prefs as any)?.volume_goal ?? "medium"),
        assignmentMethod: String((prefs as any)?.assignment_method ?? "manual"),
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

    const leadSources = normalizeLeadSources((body as any)?.leadSources ?? (body as any)?.lead_sources ?? []);
    const volumeGoal = String((body as any)?.volumeGoal ?? (body as any)?.volume_goal ?? "").trim();
    const assignmentMethod = String((body as any)?.assignmentMethod ?? (body as any)?.assignment_method ?? "").trim();

    if (!volumeGoal) {
      return NextResponse.json({ ok: false, error: "Volume goal is required" }, { status: 400 });
    }

    const allowedVolume = new Set(["low", "medium", "high", "very_high"]);
    if (!allowedVolume.has(volumeGoal)) {
      return NextResponse.json({ ok: false, error: "Invalid volume goal" }, { status: 400 });
    }

    const allowedAssign = new Set(["manual", "round_robin", "geographic", "specialization"]);
    if (!allowedAssign.has(assignmentMethod)) {
      return NextResponse.json({ ok: false, error: "Invalid assignment method" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const orgId = await getOrgIdForUser(admin, user.id);
    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Missing organization" }, { status: 500 });
    }

    const { error: prefErr } = await admin
      .from("lead_preferences")
      .upsert(
        {
          organization_id: orgId,
          lead_sources: leadSources as any,
          volume_goal: volumeGoal,
          assignment_method: assignmentMethod,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "organization_id" }
      );

    if (prefErr) {
      return NextResponse.json({ ok: false, error: prefErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
