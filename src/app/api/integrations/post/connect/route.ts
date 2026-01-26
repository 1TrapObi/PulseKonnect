import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { testPostConnection } from "@/lib/integrations/post";

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

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const apiKey = String((body as any).apiKey ?? "").trim();

    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ connected: false, error: "Unauthorized" }, { status: 401 });
    }

    const result = await testPostConnection(apiKey);
    if (!result.connected) {
      return NextResponse.json({ connected: false, error: result.error ?? "Connection failed" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const orgId = await getOrgIdForUser(admin, user.id);
    if (!orgId) {
      return NextResponse.json({ connected: false, error: "Missing organization" }, { status: 500 });
    }

    const { error } = await admin
      .from("organizations")
      .update({ post_api_key: apiKey, post_connected: true })
      .eq("id", orgId);

    if (error) {
      return NextResponse.json({ connected: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ connected: true });
  } catch (e: any) {
    return NextResponse.json({ connected: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
