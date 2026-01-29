import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/db/supabase/server";

export async function POST() {
  try {
    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const res = await sb.auth.signOut({ scope: "global" } as any);
    if ((res as any)?.error) {
      await sb.auth.signOut();
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
