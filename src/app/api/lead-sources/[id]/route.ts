import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { getOrgIdForUser } from "@/lib/api/org";

function asOptionalString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function asOptionalBoolean(v: unknown): boolean | null {
  if (typeof v !== "boolean") return null;
  return v;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as any;

    const patch: any = {};

    const name = asOptionalString(body?.name);
    if (name !== null) {
      if (!name) return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
      patch.name = name;
    }

    const baseUrl = asOptionalString(body?.baseUrl);
    if (baseUrl !== null) patch.base_url = baseUrl;

    const scanFrequency = asOptionalString(body?.scanFrequency);
    if (scanFrequency !== null) patch.scan_frequency = scanFrequency;

    const isEnabled = asOptionalBoolean(body?.isEnabled);
    if (isEnabled !== null) patch.is_enabled = isEnabled;

    if ("urls" in body) patch.urls = body.urls ?? null;
    if ("searchParameters" in body) patch.search_parameters = body.searchParameters ?? null;
    if ("runFrequency" in body) patch.run_frequency = body.runFrequency ?? null;
    if ("priority" in body) patch.priority = body.priority ?? null;

    if ("maxResultsPerRun" in body) patch.max_results_per_run = body.maxResultsPerRun ?? null;
    if ("dedupWindowDays" in body) patch.dedup_window_days = body.dedupWindowDays ?? null;
    if ("autoQualify" in body) patch.auto_qualify = body.autoQualify ?? null;
    if ("autoRejectBelowScore" in body) patch.auto_reject_below_score = body.autoRejectBelowScore ?? null;

    if (!Object.keys(patch).length) {
      return NextResponse.json({ ok: false, error: "No changes" }, { status: 400 });
    }

    const orgId = await getOrgIdForUser(user.id);
    const admin = createSupabaseAdminClient();

    const { data: existing, error: getErr } = await admin
      .from("lead_sources")
      .select("id,organization_id,parent_source_id")
      .eq("id", id)
      .maybeSingle();

    if (getErr) {
      return NextResponse.json({ ok: false, error: getErr.message }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const existingOrgId = (existing as any).organization_id ? String((existing as any).organization_id) : null;
    const parentSourceId = (existing as any).parent_source_id ? String((existing as any).parent_source_id) : null;

    // Global sources are immutable from the org UI; require using override mechanism.
    if (!existingOrgId) {
      return NextResponse.json(
        { ok: false, error: "Global sources cannot be edited directly" },
        { status: 403 }
      );
    }

    if (existingOrgId !== orgId) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // Org-owned sources (including overrides) can be updated.
    patch.updated_at = new Date().toISOString();

    const { error: updErr } = await admin.from("lead_sources").update(patch).eq("id", id);

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, parentSourceId: parentSourceId ?? null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const orgId = await getOrgIdForUser(user.id);
    const admin = createSupabaseAdminClient();

    const { data: existing, error: getErr } = await admin
      .from("lead_sources")
      .select("id,organization_id,parent_source_id")
      .eq("id", id)
      .maybeSingle();

    if (getErr) {
      return NextResponse.json({ ok: false, error: getErr.message }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const existingOrgId = (existing as any).organization_id ? String((existing as any).organization_id) : null;

    // Do not allow deleting global sources.
    if (!existingOrgId) {
      return NextResponse.json(
        { ok: false, error: "Global sources cannot be deleted" },
        { status: 403 }
      );
    }

    if (existingOrgId !== orgId) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { error: delErr } = await admin
      .from("lead_sources")
      .update({ is_active: false, updated_at: new Date().toISOString() } as any)
      .eq("id", id);

    if (delErr) {
      return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
