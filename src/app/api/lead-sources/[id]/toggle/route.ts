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
      .select("id,organization_id")
      .eq("id", id)
      .maybeSingle();

    if (getErr) {
      return NextResponse.json({ ok: false, error: getErr.message }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const ownerOrgId = (existing as any).organization_id ? String((existing as any).organization_id) : null;
    if (ownerOrgId && ownerOrgId !== orgId) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { error: updErr } = await admin
      .from("lead_sources")
      .update({ is_enabled: isEnabled, updated_at: new Date().toISOString() } as any)
      .eq("id", id);

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
