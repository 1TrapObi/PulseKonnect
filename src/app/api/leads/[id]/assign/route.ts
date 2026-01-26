import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { createNotificationAndMaybeEnqueueEmail } from "@/lib/notifications/create";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const userId = String(body.userId ?? "");

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 });
    }

    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();

    const { data: callerRow, error: callerErr } = await admin
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (callerErr || !callerRow?.organization_id) {
      return NextResponse.json({ ok: false, error: "Missing organization" }, { status: 500 });
    }

    const orgId = callerRow.organization_id as string;

    const { data: assigneeRow } = await admin
      .from("users")
      .select("id,role,email")
      .eq("id", userId)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!assigneeRow) {
      return NextResponse.json({ ok: false, error: "Assignee not found" }, { status: 404 });
    }

    const role = String((assigneeRow as any).role ?? "");
    if (!(role === "staff" || role === "admin")) {
      return NextResponse.json(
        { ok: false, error: "Assignee must be staff or admin" },
        { status: 400 }
      );
    }

    const { error: updErr } = await admin
      .from("leads")
      .update({ assigned_to: userId })
      .eq("id", id)
      .eq("organization_id", orgId);

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    }

    await admin.from("activities").insert([
      {
        lead_id: id,
        user_id: user.id,
        action: "lead_assigned",
        notes: JSON.stringify({ assigned_user_id: userId }),
      },
    ]);

    const { data: leadRow } = await admin
      .from("leads")
      .select("id,name")
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (leadRow) {
      await createNotificationAndMaybeEnqueueEmail({
        organizationId: orgId,
        userId,
        leadId: id,
        reminderId: null,
        type: "lead_assigned",
        title: "New lead assigned to you",
        message: `You were assigned: ${(leadRow as any).name}`,
        link: `/leads/${id}`,
        emailTo: (assigneeRow as any).email ?? null,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
