import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const type = String(body.type ?? "").trim();
    const dueAt = body.dueAt ? new Date(String(body.dueAt)) : null;
    const emailNotification = Boolean(body.emailNotification ?? false);

    if (!type) {
      return NextResponse.json({ ok: false, error: "Missing type" }, { status: 400 });
    }
    if (!dueAt || Number.isNaN(dueAt.getTime())) {
      return NextResponse.json({ ok: false, error: "Invalid dueAt" }, { status: 400 });
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

    const { data: reminder, error } = await admin
      .from("reminders")
      .insert([
        {
          lead_id: id,
          user_id: user.id,
          type,
          due_at: dueAt.toISOString(),
          email_notification: emailNotification,
        },
      ])
      .select("id,type,due_at,email_notification,is_completed,completed_at,created_at")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    await admin.from("activities").insert([
      {
        lead_id: id,
        user_id: user.id,
        action: "reminder_set",
        notes: JSON.stringify({ type, due_at: dueAt.toISOString(), email_notification: emailNotification }),
      },
    ]);

    return NextResponse.json({ ok: true, reminder });
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
      .from("reminders")
      .select("id,type,due_at,email_notification,is_completed,completed_at,created_at,user_id")
      .eq("lead_id", id)
      .order("due_at", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, reminders: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
