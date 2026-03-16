import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { createNotificationAndMaybeEnqueueEmail } from "@/lib/notifications/create";

const ORDER = ["new", "attempted_contact", "contacted", "qualified", "converted"] as const;
type OrderedStatus = (typeof ORDER)[number];

const FINAL = new Set(["converted", "lost"]);
const LOST_REASONS = new Set(["No Response", "Declined Services", "Out of Area", "Other"]);

type LeadRow = {
  id: string;
  status: string | null;
  created_at: string;
  contacted_at: string | null;
  assigned_to: string | null;
  name: string | null;
};

type PatchBody = {
  status: string;
  lost_reason: string | null;
  contacted_at?: string;
  response_time_hours?: number;
};

type OwnerRow = { id: string; email: string | null };

function isOrderedStatus(s: string): s is OrderedStatus {
  return ORDER.includes(s as OrderedStatus);
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function normalizeStatus(s: string) {
  return s.trim().toLowerCase();
}

function isValidTransition(from: string, to: string) {
  if (from === to) return true;
  if (to === "lost") return from !== "converted";
  const fromIdx = isOrderedStatus(from) ? ORDER.indexOf(from) : -1;
  const toIdx = isOrderedStatus(to) ? ORDER.indexOf(to) : -1;
  if (fromIdx === -1 || toIdx === -1) return false;
  return toIdx === fromIdx + 1;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
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

    const { data: leadData, error: leadErr } = await admin
      .from("leads")
      .select("id,status,created_at,contacted_at,assigned_to,name")
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle();

    const lead = leadData as LeadRow | null;

    if (leadErr || !lead) {
      return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
    }

    const currentStatus = normalizeStatus(String(lead.status ?? "new"));

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

    const patch: PatchBody = { status: nextStatus, lost_reason: null };

    if (nextStatus === "lost") {
      patch.lost_reason = reason;
    }

    // response time tracking when first reaching Contacted
    if (!lead.contacted_at && nextStatus === "contacted") {
      const createdAt = new Date(lead.created_at);
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

    const assignedTo = lead.assigned_to;
    if (assignedTo && assignedTo !== user.id) {
      const { data: ownerRow } = await admin
        .from("users")
        .select("id,email")
        .eq("id", assignedTo)
        .eq("organization_id", orgId)
        .maybeSingle();

      const owner = ownerRow as OwnerRow | null;
      if (owner) {
        await createNotificationAndMaybeEnqueueEmail({
          organizationId: orgId,
          userId: assignedTo,
          leadId: id,
          reminderId: null,
          type: "status_changed",
          title: "Lead status updated",
          message: `${lead.name ?? "A lead"} status changed: ${currentStatus} → ${nextStatus}`,
          link: `/leads/${id}`,
          emailTo: owner.email ?? null,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: messageFromError(e) }, { status: 500 });
  }
}
