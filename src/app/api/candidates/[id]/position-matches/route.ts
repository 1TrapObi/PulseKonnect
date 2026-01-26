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

    const positionId = String(body.positionId ?? "").trim();
    const action = String(body.action ?? "").toLowerCase();
    const reason = body.reason ? String(body.reason) : null;

    if (!positionId) {
      return NextResponse.json({ ok: false, error: "Missing positionId" }, { status: 400 });
    }
    if (action !== "add" && action !== "remove") {
      return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
    }
    if (action === "remove" && !reason) {
      return NextResponse.json({ ok: false, error: "Remove requires reason" }, { status: 400 });
    }

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

    if (action === "add") {
      const { error } = await admin
        .from("candidate_position_matches")
        .upsert(
          [
            {
              candidate_id: id,
              position_id: positionId,
              match_score: body.matchScore ?? null,
              match_reasons: body.matchReasons ?? null,
            },
          ],
          { onConflict: "candidate_id,position_id" }
        );

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      await admin.from("activities").insert([
        {
          candidate_id: id,
          user_id: user.id,
          action: "candidate_position_match_added",
          notes: JSON.stringify({ position_id: positionId }),
        },
      ]);

      return NextResponse.json({ ok: true });
    }

    const { error } = await admin
      .from("candidate_position_matches")
      .delete()
      .eq("candidate_id", id)
      .eq("position_id", positionId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    await admin.from("activities").insert([
      {
        candidate_id: id,
        user_id: user.id,
        action: "candidate_position_match_removed",
        notes: JSON.stringify({ position_id: positionId, reason }),
      },
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
