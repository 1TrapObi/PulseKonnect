import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import {
  getConversionRates,
  getPositionPerformance,
  getSourcePerformance,
} from "@/lib/analytics/recruitment-metrics";

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
    const { startDate, endDate } = parseRange(url);

    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const [conversionRates, sourcePerformance, positionPerformance] = await Promise.all([
      getConversionRates(user.id, startDate, endDate),
      getSourcePerformance(user.id, startDate, endDate),
      getPositionPerformance(user.id, startDate, endDate),
    ]);

    return NextResponse.json({
      ok: true,
      conversionRates,
      sourcePerformance,
      positionPerformance,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
