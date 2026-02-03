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

function normalizeTextArray(input: any): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((x) => String(x)).map((x) => x.trim()).filter(Boolean);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
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

    const name = typeof body?.name === "string" ? body.name.trim() : null;
    const description = typeof body?.description === "string" ? body.description.trim() : null;
    const configuration = body?.configuration;
    const tags = "tags" in body ? normalizeTextArray(body.tags) : null;

    const patch: any = {};
    if (name !== null) {
      if (!name) return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
      patch.name = name;
    }
    if (description !== null) patch.description = description || null;
    if (configuration !== undefined) {
      if (!configuration || typeof configuration !== "object") {
        return NextResponse.json({ ok: false, error: "Configuration must be an object" }, { status: 400 });
      }
      patch.configuration = configuration as any;
    }
    if (tags !== null) patch.tags = tags as any;

    if (!Object.keys(patch).length) {
      return NextResponse.json({ ok: false, error: "No changes" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const orgId = await getOrgIdForUser(admin, user.id);
    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Missing organization" }, { status: 500 });
    }

    const { data: existing, error: getErr } = await admin
      .from("lead_profile_templates")
      .select("id,organization_id,is_system_default")
      .eq("id", id)
      .maybeSingle();

    if (getErr) {
      return NextResponse.json({ ok: false, error: getErr.message }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    if ((existing as any).is_system_default) {
      return NextResponse.json({ ok: false, error: "System templates cannot be edited" }, { status: 403 });
    }

    if (String((existing as any).organization_id ?? "") !== orgId) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    patch.updated_at = new Date().toISOString();

    const { error: updErr } = await admin
      .from("lead_profile_templates")
      .update(patch)
      .eq("id", id);

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

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

    const { data: existing, error: getErr } = await admin
      .from("lead_profile_templates")
      .select("id,organization_id,is_system_default")
      .eq("id", id)
      .maybeSingle();

    if (getErr) {
      return NextResponse.json({ ok: false, error: getErr.message }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    if ((existing as any).is_system_default) {
      return NextResponse.json({ ok: false, error: "System templates cannot be deleted" }, { status: 403 });
    }

    if (String((existing as any).organization_id ?? "") !== orgId) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { error: delErr } = await admin
      .from("lead_profile_templates")
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
