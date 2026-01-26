import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/db/supabase/server";
import { createNotificationAndMaybeEnqueueEmail } from "@/lib/notifications/create";

function requireCronAuth(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  const header = request.headers.get("x-cron-secret");
  const url = new URL(request.url);
  const qp = url.searchParams.get("secret");

  return header === secret || qp === secret;
}

export async function GET(request: Request) {
  try {
    if (!requireCronAuth(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();

    const nowIso = new Date().toISOString();

    const { data: reminders, error } = await admin
      .from("reminders")
      .select("id,lead_id,user_id,type,due_at")
      .eq("email_notification", true)
      .eq("is_completed", false)
      .lte("due_at", nowIso)
      .order("due_at", { ascending: true })
      .limit(100);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    let created = 0;
    let skipped = 0;

    for (const r of reminders ?? []) {
      const reminderId = String((r as any).id);
      const leadId = String((r as any).lead_id);
      const userId = String((r as any).user_id);

      const { data: already } = await admin
        .from("notifications")
        .select("id")
        .eq("type", "reminder_due")
        .eq("reminder_id", reminderId)
        .limit(1)
        .maybeSingle();

      if (already) {
        skipped += 1;
        continue;
      }

      const [{ data: lead }, { data: userRow }] = await Promise.all([
        admin
          .from("leads")
          .select("id,name,organization_id")
          .eq("id", leadId)
          .maybeSingle(),
        admin.from("users").select("id,email").eq("id", userId).maybeSingle(),
      ]);

      if (!lead || !userRow) {
        skipped += 1;
        continue;
      }

      await createNotificationAndMaybeEnqueueEmail({
        organizationId: String((lead as any).organization_id),
        userId,
        leadId,
        reminderId,
        type: "reminder_due",
        title: `Reminder due: ${(r as any).type}`,
        message: `Reminder for ${(lead as any).name} is due now.`,
        link: `/leads/${(lead as any).id}`,
        emailTo: (userRow as any).email ?? null,
      });

      created += 1;
    }

    return NextResponse.json({ ok: true, scanned: reminders?.length ?? 0, created, skipped });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
