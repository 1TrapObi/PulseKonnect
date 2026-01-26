import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { createNotificationAndMaybeEnqueueEmail, type NotificationType } from "@/lib/notifications/create";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const userId = String(body.userId ?? "");
    const type = String(body.type ?? "").trim() as NotificationType;
    const title = String(body.title ?? "").trim();
    const message = String(body.message ?? "").trim();
    const link = body.link ? String(body.link) : null;
    const leadId = body.leadId ? String(body.leadId) : null;
    const reminderId = body.reminderId ? String(body.reminderId) : null;

    if (!userId || !type || !title || !message) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    }

    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();

    const { data: callerRow } = await admin
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    const orgId = callerRow?.organization_id as string | undefined;
    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Missing organization" }, { status: 500 });
    }

    const { data: targetRow } = await admin
      .from("users")
      .select("id,email")
      .eq("id", userId)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!targetRow) {
      return NextResponse.json({ ok: false, error: "Target user not found" }, { status: 404 });
    }

    const { notificationId, deliveryStatus } = await createNotificationAndMaybeEnqueueEmail({
      organizationId: orgId,
      userId,
      leadId,
      reminderId,
      type,
      title,
      message,
      link,
      emailTo: (targetRow as any).email ?? null,
    });

    return NextResponse.json({ ok: true, notificationId, deliveryStatus });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
