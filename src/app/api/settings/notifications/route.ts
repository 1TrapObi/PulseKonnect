import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { defaultNotificationSettings } from "@/lib/notifications/settings";

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
    const { data, error } = await admin
      .from("notification_settings")
      .select(
        "notify_high_priority_leads,notify_lead_assignments,notify_status_updates,notify_reminders,notify_daily_summary,frequency,quiet_hours_start,quiet_hours_end,daily_digest_time"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, settings: data ?? defaultNotificationSettings() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const patch: any = {};

    const boolFields = [
      "notify_high_priority_leads",
      "notify_lead_assignments",
      "notify_status_updates",
      "notify_reminders",
      "notify_daily_summary",
    ];

    for (const f of boolFields) {
      if (f in body) patch[f] = Boolean((body as any)[f]);
    }

    if ("frequency" in body) {
      const v = String((body as any).frequency ?? "");
      if (!(v === "realtime" || v === "hourly" || v === "daily")) {
        return NextResponse.json({ ok: false, error: "Invalid frequency" }, { status: 400 });
      }
      patch.frequency = v;
    }

    if ("quiet_hours_start" in body) {
      patch.quiet_hours_start = (body as any).quiet_hours_start ? String((body as any).quiet_hours_start) : null;
    }
    if ("quiet_hours_end" in body) {
      patch.quiet_hours_end = (body as any).quiet_hours_end ? String((body as any).quiet_hours_end) : null;
    }
    if ("daily_digest_time" in body) {
      patch.daily_digest_time = (body as any).daily_digest_time ? String((body as any).daily_digest_time) : null;
    }

    patch.updated_at = new Date().toISOString();

    const admin = createSupabaseAdminClient();

    const { error } = await admin
      .from("notification_settings")
      .upsert([{ user_id: user.id, ...patch }], { onConflict: "user_id" });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
