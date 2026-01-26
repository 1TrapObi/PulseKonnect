import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { getPeriodComparison } from "@/lib/analytics/recruitment-metrics";

function parseRange(url: URL) {
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  if (!startDate || !endDate) {
    throw new Error("Missing startDate/endDate");
  }
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    throw new Error("Invalid date range");
  }
  return { startDate: s.toISOString(), endDate: e.toISOString() };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const range = parseRange(url);

    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const res = await getPeriodComparison(user.id, range);

    return NextResponse.json({
      ok: true,
      totalCandidates: res.current.totalCandidates,
      qualifiedCandidates: res.current.qualifiedCandidates,
      interviewsScheduled: res.current.interviewsScheduled,
      hiresMade: res.current.hiresMade,
      periodComparison: res.periodComparison,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
