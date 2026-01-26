import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { getPositionPerformance, getSourcePerformance } from "@/lib/analytics/recruitment-metrics";

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

function csvEscape(v: any) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return '"' + s.replaceAll('"', '""') + '"';
  }
  return s;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const { startDate, endDate } = parseRange(url);
    const exportType = String(url.searchParams.get("exportType") ?? "").trim();

    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (exportType === "positions") {
      const rows = await getPositionPerformance(user.id, startDate, endDate);
      const header = [
        "Title",
        "Status",
        "Candidates",
        "Qualified",
        "Interviews",
        "Offers",
        "Hires",
        "Days to Fill",
        "Conversion Rate",
      ];

      const lines: string[] = [header.join(",")];
      for (const r of rows) {
        lines.push(
          [
            csvEscape(r.title),
            csvEscape(r.status ?? ""),
            r.totalCandidates,
            r.qualifiedCandidates,
            r.inInterview,
            r.offers,
            r.hires,
            r.daysToFill == null ? "" : r.daysToFill,
            Math.round((r.conversionRate ?? 0) * 10000) / 100 + "%",
          ].join(",")
        );
      }

      const csv = lines.join("\n");
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": "attachment; filename=recruitment_positions_export.csv",
        },
      });
    }

    if (exportType === "candidates") {
      const admin = createSupabaseAdminClient();

      const { data: userRow, error: userErr } = await admin
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .maybeSingle();

      if (userErr || !userRow?.organization_id) {
        return NextResponse.json({ ok: false, error: userErr?.message ?? "Missing organization" }, { status: 500 });
      }

      const orgId = String((userRow as any).organization_id);

      const { data, error } = await admin
        .from("candidates")
        .select("name,license_type,experience_years,fit_score,status,source,created_at")
        .eq("organization_id", orgId)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false });

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      const header = ["Name", "License", "Experience", "Fit Score", "Status", "Source", "Applied Date"];
      const lines: string[] = [header.join(",")];

      for (const c of data ?? []) {
        lines.push(
          [
            csvEscape((c as any).name),
            csvEscape((c as any).license_type),
            csvEscape((c as any).experience_years != null ? `${(c as any).experience_years} yrs` : ""),
            csvEscape((c as any).fit_score ?? ""),
            csvEscape((c as any).status ?? ""),
            csvEscape((c as any).source ?? ""),
            csvEscape(String((c as any).created_at ?? "").slice(0, 10)),
          ].join(",")
        );
      }

      const csv = lines.join("\n");
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": "attachment; filename=recruitment_candidates_export.csv",
        },
      });
    }

    if (exportType === "summary") {
      const [sources, positions] = await Promise.all([
        getSourcePerformance(user.id, startDate, endDate),
        getPositionPerformance(user.id, startDate, endDate),
      ]);

      const lines: string[] = [];
      lines.push("Recruitment Summary");
      lines.push(`Range,${startDate.slice(0, 10)} to ${endDate.slice(0, 10)}`);

      lines.push("\nSources");
      lines.push("Source,Total Candidates,Qualified,Hired,Avg Fit Score,Hire Rate");
      for (const s of sources) {
        lines.push(
          [
            csvEscape(s.source),
            s.totalCandidates,
            s.qualified,
            s.hired,
            s.avgFitScore ?? "",
            Math.round((s.hireRate ?? 0) * 10000) / 100 + "%",
          ].join(",")
        );
      }

      lines.push("\nPositions");
      lines.push("Title,Status,Candidates,Qualified,Interviews,Offers,Hires,Days to Fill,Conversion Rate");
      for (const p of positions) {
        lines.push(
          [
            csvEscape(p.title),
            csvEscape(p.status ?? ""),
            p.totalCandidates,
            p.qualifiedCandidates,
            p.inInterview,
            p.offers,
            p.hires,
            p.daysToFill ?? "",
            Math.round((p.conversionRate ?? 0) * 10000) / 100 + "%",
          ].join(",")
        );
      }

      const csv = lines.join("\n");
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": "attachment; filename=recruitment_summary_export.csv",
        },
      });
    }

    return NextResponse.json({ ok: false, error: "Invalid exportType" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
