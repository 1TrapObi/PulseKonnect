import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";

const STATUSES = ["new", "contacted", "qualified", "converted", "lost"] as const;

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
    const { data: userRow, error: userErr } = await admin
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .limit(1)
      .maybeSingle();

    if (userErr || !userRow?.organization_id) {
      return NextResponse.json(
        { ok: false, error: userErr?.message ?? "Missing organization" },
        { status: 500 }
      );
    }

    const orgId = userRow.organization_id as string;

    const { data, error } = await admin
      .from("leads")
      .select("status")
      .eq("organization_id", orgId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const counts: Record<string, number> = {};
    for (const s of STATUSES) counts[s] = 0;

    for (const row of data ?? []) {
      const s = String((row as any).status ?? "").toLowerCase();
      if (s in counts) counts[s] += 1;
    }

    return NextResponse.json({ ok: true, ...counts });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
