import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";

async function getOrgIdForUser(admin: any, userId: string) {
  const { data: userRow, error } = await admin
    .from("users")
    .select("organization_id")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();

  if (error || !userRow?.organization_id) return null;
  return userRow.organization_id as string;
}

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
    const orgId = await getOrgIdForUser(admin, user.id);
    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Missing organization" }, { status: 500 });
    }

    const { data: members, error: membersErr } = await admin
      .from("users")
      .select("id,email,role,created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });

    if (membersErr) {
      return NextResponse.json({ ok: false, error: membersErr.message }, { status: 500 });
    }

    const { data: invites, error: invErr } = await admin
      .from("team_invitations")
      .select("id,email,role,status,created_at,expires_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (invErr) {
      return NextResponse.json({ ok: false, error: invErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      members: (members ?? []).map((m: any) => ({
        id: m.id,
        email: m.email,
        role: m.role,
        created_at: m.created_at,
      })),
      invitations: (invites ?? []).map((i: any) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        status: i.status,
        created_at: i.created_at,
        expires_at: i.expires_at,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
