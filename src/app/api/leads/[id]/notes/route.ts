import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const content = String(body.content ?? "").trim();
    const isInternal = Boolean(body.isInternal ?? true);

    if (!content) {
      return NextResponse.json({ ok: false, error: "Note content required" }, { status: 400 });
    }
    if (content.length > 500) {
      return NextResponse.json({ ok: false, error: "Max 500 characters" }, { status: 400 });
    }

    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const { data: userRow } = await admin
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    const orgId = userRow?.organization_id as string | undefined;
    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Missing organization" }, { status: 500 });
    }

    const { data: leadRow } = await admin
      .from("leads")
      .select("id")
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!leadRow) {
      return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
    }

    const { data: note, error } = await admin
      .from("notes")
      .insert([
        {
          lead_id: id,
          user_id: user.id,
          content,
          is_internal: isInternal,
        },
      ])
      .select("id,content,is_internal,created_at,user_id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    await admin.from("activities").insert([
      {
        lead_id: id,
        user_id: user.id,
        action: "note_added",
        notes: JSON.stringify({ is_internal: isInternal }),
      },
    ]);

    return NextResponse.json({ ok: true, note });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function GET(
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
    const { data: userRow } = await admin
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    const orgId = userRow?.organization_id as string | undefined;
    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Missing organization" }, { status: 500 });
    }

    const { data: leadRow } = await admin
      .from("leads")
      .select("id")
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!leadRow) {
      return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
    }

    const { data, error } = await admin
      .from("notes")
      .select("id,content,is_internal,created_at,user_id")
      .eq("lead_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, notes: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
