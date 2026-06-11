import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { normalizeRole } from "@/lib/auth/rbac";

const PAGE_SIZE = 25;

function asOptionalString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function asOptionalEnum(v: unknown, allowed: string[]): string | null {
  const s = asOptionalString(v);
  if (!s) return null;
  const lower = s.toLowerCase();
  return allowed.includes(lower) ? lower : null;
}

function parseDate(val: string | null): string | null {
  if (!val) return null;
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const urgency = url.searchParams.get("urgency");
    const source = url.searchParams.get("source");
    const search = url.searchParams.get("search");
    const startDate = parseDate(url.searchParams.get("startDate"));
    const endDate = parseDate(url.searchParams.get("endDate"));
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const idsOnly = url.searchParams.get("idsOnly") === "1";

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
      .select("organization_id,role")
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
    const role = normalizeRole((userRow as { role?: string | null }).role);

    let query = admin
      .from("leads")
      .select(
        idsOnly
          ? "id"
          : "id,name,first_name,last_name,email,phone,phone_home,date_of_birth,address_line1,city,state,zip,insurance_type,insurance_payer,insurance_id,need_type,location,source,source_url,status,urgency,qualification_status,qualification_score,quality_score,priority,ai_reasoning,created_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (role !== "super_admin") query = query.eq("organization_id", orgId);
    if (role === "staff") {
      const { data: assigned } = await admin
        .from("assigned_leads")
        .select("lead_id")
        .eq("user_id", user.id);
      const assignedIds = (assigned ?? []).map((row: { lead_id: string | null }) => row.lead_id).filter(Boolean) as string[];
      if (!assignedIds.length) {
        return NextResponse.json({
          ok: true,
          leads: [],
          ids: [],
          total: 0,
          page,
          totalPages: 1,
          sources: [],
        });
      }
      query = query.in("id", assignedIds);
    }

    if (status && status !== "all") query = query.eq("status", status);
    if (urgency && urgency !== "all") query = query.eq("urgency", urgency);
    if (source && source !== "all") query = query.eq("source", source);
    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", endDate);

    if (search && search.trim()) {
      const q = search.trim();
      query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
    }

    if (idsOnly) {
      const { data, error, count } = await query.range(0, 9999);

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        ids: ((data ?? []) as unknown as Array<{ id: string }>).map((lead) => lead.id),
        total: count ?? 0,
      });
    }

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await query.range(from, to);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const { data: sources } = await admin
      .from("lead_sources")
      .select("name")
      .order("name", { ascending: true });

    return NextResponse.json({
      ok: true,
      leads: data ?? [],
      total,
      page,
      totalPages,
      sources: Array.from(new Set((sources ?? []).map((s: any) => String(s.name))))
        .filter(Boolean)
        .map((name) => ({ value: name, label: name })),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as any;
    const name = asOptionalString(body?.name);

    if (!name) {
      return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
    }

    const email = asOptionalString(body?.email);
    const phone = asOptionalString(body?.phone);
    const location = asOptionalString(body?.location);
    const need_type = asOptionalString(body?.need_type);
    const source = asOptionalString(body?.source);
    const source_url = asOptionalString(body?.source_url);
    const notes = asOptionalString(body?.notes);
    const urgency =
      asOptionalEnum(body?.urgency, ["low", "medium", "high"]) ?? "medium";

    const admin = createSupabaseAdminClient();
    const { data: userRow, error: userErr } = await admin
      .from("users")
      .select("organization_id,role")
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
    const role = normalizeRole((userRow as { role?: string | null }).role);

    if (role === "staff") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await admin
      .from("leads")
      .insert({
        name,
        email,
        phone,
        location,
        need_type,
        source,
        source_url,
        notes,
        urgency,
        status: "new",
        created_by: user.id,
        organization_id: orgId,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, leadId: data?.id ?? null });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
