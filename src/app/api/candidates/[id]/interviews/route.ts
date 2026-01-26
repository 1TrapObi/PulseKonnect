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

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const interviewDate = body.date ? new Date(String(body.date)) : null;
    if (!interviewDate || Number.isNaN(interviewDate.getTime())) {
      return NextResponse.json({ ok: false, error: "Invalid interview date" }, { status: 400 });
    }

    const interviewType = body.type ? String(body.type) : "phone";
    const interviewers = Array.isArray(body.interviewers) ? body.interviewers : [];
    const location = body.location ? String(body.location) : null;
    const agenda = body.agenda ? String(body.agenda) : null;
    const notes = body.notes ? String(body.notes) : null;
    const positionId = body.positionId ? String(body.positionId) : null;

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

    const { data: interview, error } = await admin
      .from("interviews")
      .insert([
        {
          candidate_id: id,
          position_id: positionId,
          interview_date: interviewDate.toISOString(),
          interview_type: interviewType,
          interviewers,
          location_or_link: location,
          agenda,
          notes,
          created_by: user.id,
        },
      ])
      .select(
        "id,candidate_id,position_id,interview_date,interview_type,interviewers,location_or_link,agenda,notes,rating,feedback,status,created_by,created_at,updated_at"
      )
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    await admin.from("activities").insert([
      {
        candidate_id: id,
        user_id: user.id,
        action: "candidate_interview_scheduled",
        notes: JSON.stringify({ interview_id: interview?.id ?? null, interview_type: interviewType }),
      },
    ]);

    return NextResponse.json({ ok: true, interview });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
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

    const { data, error } = await admin
      .from("interviews")
      .select(
        "id,candidate_id,position_id,interview_date,interview_type,interviewers,location_or_link,agenda,notes,rating,feedback,status,created_by,created_at,updated_at"
      )
      .eq("candidate_id", id)
      .order("interview_date", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, interviews: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
