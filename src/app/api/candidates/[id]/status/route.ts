import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";

const ORDER = ["new", "screening", "interview", "offer", "hired"] as const;
const FINAL = new Set(["hired", "rejected"]);

function normalizeStatus(s: string) {
  return s.trim().toLowerCase();
}

function isValidTransition(from: string, to: string) {
  if (from === to) return true;
  if (FINAL.has(from)) return false;

  // Allow moving into final states (reason validation handled separately)
  if (to === "hired" || to === "rejected") return true;

  // Allow free movement within the pipeline (non-final statuses)
  const pipeline = new Set(["new", "screening", "interview", "offer"]);
  if (pipeline.has(from) && pipeline.has(to)) return true;

  return false;
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

    if (nextStatus === "hired" || nextStatus === "rejected") {
      if (!reason) {
        return NextResponse.json(
          { ok: false, error: "Final status requires reason" },
          { status: 400 }
        );
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

    const { data: cand, error: candErr } = await admin
      .from("candidates")
      .select("id,status,name")
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (candErr || !cand) {
      return NextResponse.json({ ok: false, error: "Candidate not found" }, { status: 404 });
    }

    const currentStatus = normalizeStatus(String((cand as any).status ?? "new"));

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

    const { error: updErr } = await admin
      .from("candidates")
      .update(patch)
      .eq("id", id)
      .eq("organization_id", orgId);

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    }

    await admin.from("activities").insert([
      {
        candidate_id: id,
        user_id: user.id,
        action: "candidate_status_changed",
        notes: JSON.stringify({ candidate_id: id, from: currentStatus, to: nextStatus, reason: reason ?? null }),
      },
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
