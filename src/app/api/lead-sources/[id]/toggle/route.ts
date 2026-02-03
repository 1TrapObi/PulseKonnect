import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { getOrgIdForUser } from "@/lib/api/org";

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
    const isEnabled = body?.isEnabled;

    if (typeof isEnabled !== "boolean") {
      return NextResponse.json({ ok: false, error: "isEnabled must be a boolean" }, { status: 400 });
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

    const nowIso = new Date().toISOString();

    // If this is a global source (organization_id is null), never mutate it directly.
    // Instead, create/update an org-specific override row pointing at the global source.
    if (!existingOrgId) {
      const globalId = String((existing as any).id);

      const { data: overrideExisting, error: overrideGetErr } = await admin
        .from("lead_sources")
        .select("id")
        .eq("organization_id", orgId)
        .eq("parent_source_id", globalId)
        .eq("is_active", true)
        .maybeSingle();

      if (overrideGetErr) {
        return NextResponse.json({ ok: false, error: overrideGetErr.message }, { status: 500 });
      }

      if (overrideExisting?.id) {
        const { error: updErr } = await admin
          .from("lead_sources")
          .update({ is_enabled: isEnabled, updated_at: nowIso } as any)
          .eq("id", String((overrideExisting as any).id));

        if (updErr) {
          return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true, effectiveSourceId: String((overrideExisting as any).id) });
      }

      // Create an override by copying the global row but scoping it to the org.
      const { data: globalRow, error: globalGetErr } = await admin
        .from("lead_sources")
        .select("name,source_type,base_url,urls,search_parameters,run_frequency,priority,max_results_per_run,dedup_window_days,auto_qualify,auto_reject_below_score,scan_frequency")
        .eq("id", globalId)
        .maybeSingle();

      if (globalGetErr) {
        return NextResponse.json({ ok: false, error: globalGetErr.message }, { status: 500 });
      }

      if (!globalRow) {
        return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
      }

      const { data: created, error: insErr } = await admin
        .from("lead_sources")
        .insert({
          organization_id: orgId,
          parent_source_id: globalId,
          name: (globalRow as any).name,
          source_type: (globalRow as any).source_type,
          base_url: (globalRow as any).base_url,
          urls: (globalRow as any).urls,
          search_parameters: (globalRow as any).search_parameters,
          run_frequency: (globalRow as any).run_frequency,
          priority: (globalRow as any).priority,
          max_results_per_run: (globalRow as any).max_results_per_run,
          dedup_window_days: (globalRow as any).dedup_window_days,
          auto_qualify: (globalRow as any).auto_qualify,
          auto_reject_below_score: (globalRow as any).auto_reject_below_score,
          scan_frequency: (globalRow as any).scan_frequency,
          is_active: true,
          is_enabled: isEnabled,
          created_at: nowIso,
          updated_at: nowIso,
        } as any)
        .select("id")
        .maybeSingle();

      if (insErr) {
        return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, effectiveSourceId: created?.id ?? null });
    }

    // Org-owned sources (including overrides by direct id) can be updated directly.
    // Prevent cross-org updates.
    if (existingOrgId !== orgId) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // For org rows, parent_source_id may be set or null; either way it's scoped to the org.
    if (parentSourceId && !parentSourceId.trim()) {
      // defensive (shouldn't happen)
    }

    const { error: updErr } = await admin
      .from("lead_sources")
      .update({ is_enabled: isEnabled, updated_at: nowIso } as any)
      .eq("id", id);

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, effectiveSourceId: id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
