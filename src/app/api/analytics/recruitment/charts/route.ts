import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import {
  getCandidatesBySource,
  getCandidateTrendDaily,
  getFitScoreDistribution,
  getPipelineFunnel,
  getHiresByPosition,
  getTimeToHireByPosition,
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
    const chartType = String(url.searchParams.get("chartType") ?? "").trim();

    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (chartType === "source") {
      const data = await getCandidatesBySource(user.id, startDate, endDate);
      return NextResponse.json({ ok: true, chartType, data });
    }

    if (chartType === "funnel") {
      const data = await getPipelineFunnel(user.id, startDate, endDate);
      return NextResponse.json({ ok: true, chartType, data });
    }

    if (chartType === "fitDistribution") {
      const data = await getFitScoreDistribution(user.id, startDate, endDate);
      return NextResponse.json({ ok: true, chartType, data });
    }

    if (chartType === "trend") {
      const data = await getCandidateTrendDaily(user.id, startDate, endDate);
      return NextResponse.json({ ok: true, chartType, data });
    }

    if (chartType === "hiresByPosition") {
      const data = await getHiresByPosition(user.id, startDate, endDate);
      return NextResponse.json({ ok: true, chartType, data });
    }

    if (chartType === "timeToHire") {
      const data = await getTimeToHireByPosition(user.id, startDate, endDate);
      return NextResponse.json({ ok: true, chartType, data });
    }

    return NextResponse.json({ ok: false, error: "Invalid chartType" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
