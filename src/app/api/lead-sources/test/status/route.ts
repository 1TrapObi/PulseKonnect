import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { getOrgIdForUser } from "@/lib/api/org";

const DAILY_LIMIT = 3;

function startOfTomorrowUtcIso() {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  return tomorrow.toISOString();
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

    const orgId = await getOrgIdForUser(user.id);
    const admin = createSupabaseAdminClient();

    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await admin
      .from("lead_source_test_usage")
      .select("test_count,last_test_at,reset_at,test_date")
      .eq("organization_id", orgId)
      .eq("test_date", today)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const used = Number((data as any)?.test_count ?? 0);
    const remaining = Math.max(0, DAILY_LIMIT - used);

    return NextResponse.json({
      ok: true,
      dailyLimit: DAILY_LIMIT,
      used,
      remaining,
      resetAt: (data as any)?.reset_at ?? startOfTomorrowUtcIso(),
      lastTestAt: (data as any)?.last_test_at ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
