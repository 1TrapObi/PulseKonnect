import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; reminderId: string }> }
) {
  try {
    const { id, reminderId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const isCompleted = Boolean(body.isCompleted ?? true);

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

    const patch: Record<string, any> = {
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
    };

    const { error } = await admin
      .from("reminders")
      .update(patch)
      .eq("id", reminderId)
      .eq("lead_id", id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    await admin.from("activities").insert([
      {
        lead_id: id,
        user_id: user.id,
        action: "reminder_completed",
        notes: JSON.stringify({ reminder_id: reminderId, is_completed: isCompleted }),
      },
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
