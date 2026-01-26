import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";

async function getOrgIdForUser(admin: any, userId: string) {
  const { data } = await admin
    .from("users")
    .select("organization_id")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();
  return (data?.organization_id as string | undefined) ?? null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; interviewId: string }> }
) {
  try {
    const { id, interviewId } = await context.params;
    const body = await request.json().catch(() => ({}));

    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const orgId = await getOrgIdForUser(admin, user.id);
    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Missing organization" }, { status: 500 });
    }

    const { data: candidateRow } = await admin
      .from("candidates")
      .select("id")
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!candidateRow) {
      return NextResponse.json({ ok: false, error: "Candidate not found" }, { status: 404 });
    }

    const patch: Record<string, any> = {};

    if (typeof body.status === "string") patch.status = body.status;
    if (typeof body.notes === "string") patch.notes = body.notes;
    if (typeof body.feedback === "string") patch.feedback = body.feedback;
    if (typeof body.rating === "number") patch.rating = body.rating;

    if (body.date) {
      const d = new Date(String(body.date));
      if (!Number.isNaN(d.getTime())) patch.interview_date = d.toISOString();
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ ok: true });
    }

    const { error } = await admin
      .from("interviews")
      .update(patch)
      .eq("id", interviewId)
      .eq("candidate_id", id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    await admin.from("activities").insert([
      {
        candidate_id: id,
        user_id: user.id,
        action: "candidate_interview_updated",
        notes: JSON.stringify({ interview_id: interviewId, fields: Object.keys(patch) }),
      },
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
