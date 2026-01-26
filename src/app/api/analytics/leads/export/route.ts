import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";

function escapeCsv(val: any) {
  const s = String(val ?? "");
  if (s.includes("\n") || s.includes(",") || s.includes('"')) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

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

    const { data: leads, error } = await admin
      .from("leads")
      .select("name,email,phone,source,status,created_at,response_time_hours")
      .eq("organization_id", orgId)
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const header = [
      "Name",
      "Email",
      "Phone",
      "Source",
      "Status",
      "Created",
      "Response Time",
      "Qualified Date",
      "Converted Date",
    ];

    const rows = (leads ?? []).map((l: any) => {
      const responseTime =
        l.response_time_hours == null || l.response_time_hours === ""
          ? ""
          : `${l.response_time_hours} hrs`;
      return [
        escapeCsv(l.name),
        escapeCsv(l.email),
        escapeCsv(l.phone),
        escapeCsv(l.source),
        escapeCsv(l.status),
        escapeCsv(l.created_at),
        escapeCsv(responseTime),
        "",
        "",
      ].join(",");
    });

    const csv = [header.join(","), ...rows].join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename=leads_export_${startDate.slice(0, 10)}_${endDate.slice(0, 10)}.csv`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
