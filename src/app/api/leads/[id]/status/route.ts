import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { createNotificationAndMaybeEnqueueEmail } from "@/lib/notifications/create";

const ORDER = ["new", "contacted", "qualified", "converted"] as const;
const FINAL = new Set(["converted", "lost"]);
const LOST_REASONS = new Set(["No Response", "Declined Services", "Out of Area", "Other"]);

function normalizeStatus(s: string) {
  return s.trim().toLowerCase();
}

function isValidTransition(from: string, to: string) {
  if (from === to) return true;
  if (to === "lost") return from !== "converted";
  const fromIdx = ORDER.indexOf(from as any);
  const toIdx = ORDER.indexOf(to as any);
  if (fromIdx === -1 || toIdx === -1) return false;
  return toIdx === fromIdx + 1;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const nextStatus = normalizeStatus(String(body.status ?? ""));
    const reason = body.reason ? String(body.reason) : null;

    if (!nextStatus) {
      return NextResponse.json({ ok: false, error: "Missing status" }, { status: 400 });
    }

    if (nextStatus === "lost") {
      if (!reason) {
        return NextResponse.json({ ok: false, error: "Lost requires reason" }, { status: 400 });
      }
      if (!LOST_REASONS.has(reason)) {
        return NextResponse.json({ ok: false, error: "Invalid lost reason" }, { status: 400 });
      }
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

    const { data: lead, error: leadErr } = await admin
      .from("leads")
      .select("id,status,created_at,contacted_at,assigned_to,name")
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (leadErr || !lead) {
      return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
    }

    const currentStatus = normalizeStatus(String((lead as any).status ?? "new"));

    if (!isValidTransition(currentStatus, nextStatus)) {
      return NextResponse.json(
        { ok: false, error: `Invalid status transition: ${currentStatus} -> ${nextStatus}` },
        { status: 400 }
      );
    }

    if (FINAL.has(currentStatus)) {
      return NextResponse.json(
        { ok: false, error: "Cannot change status after final state" },
        { status: 400 }
      );
    }

    const patch: Record<string, any> = { status: nextStatus };

    if (nextStatus === "lost") {
      patch.lost_reason = reason;
    } else {
      patch.lost_reason = null;
    }

    // response time tracking when New -> Contacted
    if (currentStatus === "new" && nextStatus === "contacted") {
      const createdAt = new Date(String((lead as any).created_at));
      const contactedAt = new Date();
      patch.contacted_at = contactedAt.toISOString();
      const hours = (contactedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      patch.response_time_hours = Math.round(hours * 10) / 10;
    }

    const { error: updErr } = await admin
      .from("leads")
      .update(patch)
      .eq("id", id)
      .eq("organization_id", orgId);

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    }

    await admin.from("activities").insert([
      {
        lead_id: id,
        user_id: user.id,
        action: "lead_status_changed",
        notes: JSON.stringify({ from: currentStatus, to: nextStatus, reason: reason ?? null }),
      },
    ]);

    const assignedTo = (lead as any).assigned_to as string | null;
    if (assignedTo && assignedTo !== user.id) {
      const { data: ownerRow } = await admin
        .from("users")
        .select("id,email")
        .eq("id", assignedTo)
        .eq("organization_id", orgId)
        .maybeSingle();

      if (ownerRow) {
        await createNotificationAndMaybeEnqueueEmail({
          organizationId: orgId,
          userId: assignedTo,
          leadId: id,
          reminderId: null,
          type: "status_changed",
          title: "Lead status updated",
          message: `${(lead as any).name ?? "A lead"} status changed: ${currentStatus} → ${nextStatus}`,
          link: `/leads/${id}`,
          emailTo: (ownerRow as any).email ?? null,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
