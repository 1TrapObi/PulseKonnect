import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";

export async function GET() {
  try {
    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
    const host = url ? new URL(url).host : null;

    if (!user) {
      return NextResponse.json({
        ok: true,
        supabaseHost: host,
        user: null,
        userRow: null,
      });
    }

    const admin = createSupabaseAdminClient();
    const { data: userRow, error: userErr } = await admin
      .from("users")
      .select("id,email,organization_id,role")
      .eq("id", user.id)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      supabaseHost: host,
      user: { id: user.id, email: user.email },
      userRow,
      userRowError: userErr?.message ?? null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
