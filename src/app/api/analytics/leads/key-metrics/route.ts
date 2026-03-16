import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { getAvgResponseTime } from "@/lib/analytics/lead-metrics";

type UserRow = { organization_id: string | null };
type FastestLeadRow = { id: string; response_time_hours: number };
type ActivityRow = { user_id: string | null; notes: string | null; created_at: string };
type NotesShape = { to?: string };
type ResponderRow = { email: string | null };

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
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
      return NextResponse.json(
        { ok: false, error: userErr?.message ?? "Missing organization" },
        { status: 500 }
      );
    }

    const orgId = String((userRow as UserRow).organization_id);

    const avgResponseTimeHours = await getAvgResponseTime(user.id, startDate, endDate);

    // Fastest response: smallest response_time_hours in range.
    // Associate responder via the earliest activity that moved the lead to contacted.
    const { data: fastestLead } = await admin
      .from("leads")
      .select("id,response_time_hours")
      .eq("organization_id", orgId)
      .not("response_time_hours", "is", null)
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("response_time_hours", { ascending: true })
      .limit(1)
      .maybeSingle();

    let fastestResponse: { hours: number; userEmail: string | null } | null = null;

    const lead = fastestLead as FastestLeadRow | null;
    if (lead?.id && lead?.response_time_hours != null) {
      const leadId = String(lead.id);
      const hours = Number(lead.response_time_hours);

      const { data: acts } = await admin
        .from("activities")
        .select("user_id,notes,created_at")
        .eq("lead_id", leadId)
        .eq("action", "lead_status_changed")
        .order("created_at", { ascending: true });

      let responderUserId: string | null = null;
      for (const a of (acts ?? []) as ActivityRow[]) {
        try {
          const notes = a.notes ? (JSON.parse(String(a.notes)) as NotesShape) : null;
          if (notes?.to === "contacted") {
            responderUserId = a.user_id ? String(a.user_id) : null;
            break;
          }
        } catch {
          // ignore malformed notes
        }
      }

      let email: string | null = null;
      if (responderUserId) {
        const { data: responder } = await admin
          .from("users")
          .select("email")
          .eq("id", responderUserId)
          .eq("organization_id", orgId)
          .maybeSingle();
        const responderRow = responder as ResponderRow | null;
        email = responderRow?.email ? String(responderRow.email) : null;
      }

      if (Number.isFinite(hours)) {
        fastestResponse = { hours: Math.round(hours * 10) / 10, userEmail: email };
      }
    }

    return NextResponse.json({
      ok: true,
      avgResponseTimeHours,
      fastestResponse,
    });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: messageFromError(e) }, { status: 500 });
  }
}
