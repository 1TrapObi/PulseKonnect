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
      .select("id,organization_id,is_system_default,is_active,name,description,configuration,tags")
      .eq("id", templateId)
      .eq("is_active", true)
      .maybeSingle();

    if (tmplErr) {
      return NextResponse.json({ ok: false, error: tmplErr.message }, { status: 500 });
    }

    if (!template) {
      return NextResponse.json({ ok: false, error: "Template not found" }, { status: 404 });
    }

    if ((template as any).organization_id) {
      return NextResponse.json({ ok: false, error: "Only system templates can be duplicated" }, { status: 400 });
    }

    const baseName = String((template as any).name ?? "").trim() || "Template";

    const { data: created, error: createErr } = await admin
      .from("lead_profile_templates")
      .insert({
        organization_id: orgId,
        name: `${baseName} (Custom)`,
        description: (template as any).description ?? null,
        is_system_default: false,
        is_active: true,
        configuration: (template as any).configuration ?? {},
        tags: normalizeTextArray((template as any).tags) as any,
        created_by: user.id,
      })
      .select("id")
      .maybeSingle();

    if (createErr) {
      return NextResponse.json({ ok: false, error: createErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: created?.id ?? null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
