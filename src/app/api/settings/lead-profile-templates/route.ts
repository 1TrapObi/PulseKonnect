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

    const { data, error } = await admin
      .from("lead_profile_templates")
      .select(
        "id,organization_id,name,description,is_system_default,is_active,configuration,tags,usage_count,created_at,updated_at"
      )
      .eq("is_active", true)
      .or(`organization_id.is.null,organization_id.eq.${orgId}`)
      .order("is_system_default", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      templates: (data ?? []).map((t: any) => ({
        id: t.id,
        organizationId: t.organization_id,
        name: t.name,
        description: t.description,
        isSystemDefault: Boolean(t.is_system_default),
        isActive: Boolean(t.is_active),
        configuration: t.configuration,
        tags: normalizeTextArray(t.tags),
        usageCount: Number(t.usage_count ?? 0),
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      })),
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
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as any;
    const name = String(body?.name ?? "").trim();
    const description = String(body?.description ?? "").trim();
    const configuration = body?.configuration;
    const tags = normalizeTextArray(body?.tags);

    if (!name) {
      return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
    }

    if (!configuration || typeof configuration !== "object") {
      return NextResponse.json({ ok: false, error: "Configuration is required" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const orgId = await getOrgIdForUser(admin, user.id);
    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Missing organization" }, { status: 500 });
    }

    const { data: created, error } = await admin
      .from("lead_profile_templates")
      .insert({
        organization_id: orgId,
        name,
        description: description || null,
        is_system_default: false,
        is_active: true,
        configuration: configuration as any,
        tags: tags as any,
        created_by: user.id,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: created?.id ?? null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
