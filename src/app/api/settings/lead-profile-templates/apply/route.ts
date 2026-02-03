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

function asOptionalBoolean(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  return null;
}

export async function POST(request: Request) {
  try {
    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as any;
    const templateId = String(body?.templateId ?? "").trim();

    if (!templateId) {
      return NextResponse.json({ ok: false, error: "templateId is required" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const orgId = await getOrgIdForUser(admin, user.id);
    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Missing organization" }, { status: 500 });
    }

    const { data: template, error: tmplErr } = await admin
      .from("lead_profile_templates")
      .select("id,organization_id,is_system_default,is_active,configuration")
      .eq("id", templateId)
      .eq("is_active", true)
      .maybeSingle();

    if (tmplErr) {
      return NextResponse.json({ ok: false, error: tmplErr.message }, { status: 500 });
    }

    if (!template) {
      return NextResponse.json({ ok: false, error: "Template not found" }, { status: 404 });
    }

    const ownerOrgId = (template as any).organization_id as string | null;
    if (ownerOrgId && ownerOrgId !== orgId) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const config = (template as any).configuration ?? {};

    const leadSources = normalizeLeadSources((config as any).leadSources);
    const volumeGoal = String((config as any).volumeGoal ?? "").trim();
    const assignmentMethod = String((config as any).assignmentMethod ?? "").trim();

    if (!volumeGoal) {
      return NextResponse.json({ ok: false, error: "Template is missing volumeGoal" }, { status: 400 });
    }

    const allowedVolume = new Set(["low", "medium", "high", "very_high"]);
    if (!allowedVolume.has(volumeGoal)) {
      return NextResponse.json({ ok: false, error: "Template has invalid volumeGoal" }, { status: 400 });
    }

    const allowedAssign = new Set(["manual", "round_robin", "geographic", "specialization"]);
    if (!allowedAssign.has(assignmentMethod)) {
      return NextResponse.json({ ok: false, error: "Template has invalid assignmentMethod" }, { status: 400 });
    }

    const emailHighPriority = asOptionalBoolean((config as any).emailHighPriority);
    const dailyDigest = asOptionalBoolean((config as any).dailyDigest);
    const weeklyReport = asOptionalBoolean((config as any).weeklyReport);

    const upsertRow: any = {
      organization_id: orgId,
      lead_sources: leadSources as any,
      volume_goal: volumeGoal,
      assignment_method: assignmentMethod,
      updated_at: new Date().toISOString(),
    };

    if (emailHighPriority !== null) upsertRow.email_high_priority = emailHighPriority;
    if (dailyDigest !== null) upsertRow.daily_digest = dailyDigest;
    if (weeklyReport !== null) upsertRow.weekly_report = weeklyReport;

    const { error: prefErr } = await admin
      .from("lead_preferences")
      .upsert(upsertRow, { onConflict: "organization_id" });

    if (prefErr) {
      return NextResponse.json({ ok: false, error: prefErr.message }, { status: 500 });
    }

    await admin
      .from("lead_profile_templates")
      .update({ usage_count: Number((template as any).usage_count ?? 0) + 1, updated_at: new Date().toISOString() })
      .eq("id", templateId);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
