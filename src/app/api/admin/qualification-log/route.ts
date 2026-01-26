import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/db/supabase/server";

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("activities")
      .select("id, lead_id, action, notes, created_at")
      .in("action", ["lead_qualification_decision", "lead_qualification_failed"])
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
