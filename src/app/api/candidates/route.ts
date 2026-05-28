import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";

const STATUSES = ["new", "screening", "interview", "offer", "hired", "rejected"] as const;

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

function asOptionalInt(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeStatus(s: string | null): string | null {
  if (!s) return null;
  const t = s.trim().toLowerCase();
  return t ? t : null;
}

async function getOrgIdForUser(admin: any, userId: string) {
  const { data: userRow, error } = await admin
    .from("users")
    .select("organization_id")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();

  if (error || !userRow?.organization_id) return null;
  return userRow.organization_id as string;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const status = normalizeStatus(url.searchParams.get("status"));
    const positionId = asOptionalString(url.searchParams.get("position"));
    const license = asOptionalString(url.searchParams.get("license"));
    const experience = asOptionalEnum(url.searchParams.get("experience"), ["entry", "mid", "senior"]);
    const fitScore = asOptionalEnum(url.searchParams.get("fitScore"), ["excellent", "good", "fair", "poor"]);
    const locationFit = asOptionalEnum(url.searchParams.get("location"), ["in-area", "adjacent", "remote"]);
    const search = asOptionalString(url.searchParams.get("search"));

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

    const selectFull =
      "id,name,email,phone,license_type,license_number,experience_years,experience_level,specializations,location,current_employer,source,source_url,status,fit_score,qualification_status,matched_positions,created_at,updated_at";

    const selectFallback =
      "id,name,email,phone,license_type,license_number,experience_years,specializations,location,current_employer,source,source_url,status,fit_score,created_at";

    let supportsExperienceLevel = true;
    let supportsLocationFit = true;
    let supportsMatchedPositions = true;

    const baseQuery = (columns: string) =>
      admin
        .from("candidates")
        .select(columns, { count: "exact" })
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

    const applyFiltersExceptStatus = (
      query: any
    ) => {
      let x = query.eq("organization_id", orgId);
      if (license && license !== "all") x = x.eq("license_type", license);
      if (supportsExperienceLevel && experience && experience !== "all") x = x.eq("experience_level", experience);
      if (supportsLocationFit && locationFit && locationFit !== "all") x = x.eq("location_fit", locationFit);

      if (fitScore && fitScore !== "all") {
        if (fitScore === "excellent") x = x.gte("fit_score", 75);
        else if (fitScore === "good") x = x.gte("fit_score", 60).lt("fit_score", 75);
        else if (fitScore === "fair") x = x.gte("fit_score", 40).lt("fit_score", 60);
        else if (fitScore === "poor") x = x.lt("fit_score", 40);
      }

      if (supportsMatchedPositions && positionId && positionId !== "all") {
        x = x.contains("matched_positions", [{ position_id: positionId }]);
      }

      if (search && search.trim()) {
        const s = search.trim();
        x = x.or(`name.ilike.%${s}%,email.ilike.%${s}%,license_number.ilike.%${s}%`);
      }

      return x;
    };

    let candidates: any[] = [];

    {
      let q = baseQuery(selectFull);
      q = applyFiltersExceptStatus(q);
      if (status && status !== "all") q = q.eq("status", status);
      const fullResp = await q;

      if (!fullResp.error) {
        candidates = fullResp.data ?? [];
      } else {
        supportsExperienceLevel = false;
        supportsLocationFit = false;
        supportsMatchedPositions = false;

        let q2 = baseQuery(selectFallback);
        q2 = applyFiltersExceptStatus(q2);
        if (status && status !== "all") q2 = q2.eq("status", status);
        const fallbackResp = await q2;

        if (fallbackResp.error) {
          return NextResponse.json({ ok: false, error: fallbackResp.error.message }, { status: 500 });
        }
        candidates = fallbackResp.data ?? [];
      }
    }

    const stats: Record<string, number> = {
      new: 0,
      screening: 0,
      interview: 0,
      offer: 0,
      hired: 0,
      rejected: 0,
    };

    for (const s of STATUSES) {
      const resp = await applyFiltersExceptStatus(
        admin.from("candidates").select("id", { count: "exact", head: true })
      )
        .eq("status", s)
        .limit(1);
      stats[s] = resp.count ?? 0;
    }

    let positions: Array<{ value: string; label: string }> = [];
    try {
      const { data: p } = await admin
        .from("positions")
        .select("id,title")
        .eq("organization_id", orgId)
        .order("title", { ascending: true });
      positions = (p ?? [])
        .map((row: any) => ({ value: String(row.id), label: String(row.title ?? row.id) }))
        .filter((x) => x.value && x.label);
    } catch {
      positions = [];
    }

    const licenses = Array.from(
      new Set((candidates ?? []).map((c: any) => (c.license_type ? String(c.license_type) : "")).filter(Boolean))
    )
      .sort()
      .map((x) => ({ value: x, label: x }));

    return NextResponse.json({
      ok: true,
      candidates: candidates ?? [],
      stats,
      positions,
      licenses,
      statuses: STATUSES,
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
    const body = await request.json().catch(() => ({}));
    const name = asOptionalString(body.name);
    const email = asOptionalString(body.email);
    const phone = asOptionalString(body.phone);
    const positionId = asOptionalString(body.positionId);
    const positionTitle = asOptionalString(body.positionTitle);
    const licenseType = asOptionalString(body.licenseType);
    const licenseNumber = asOptionalString(body.licenseNumber);
    const experienceYears = asOptionalInt(asOptionalString(body.experienceYears));
    const location = asOptionalString(body.location);
    const currentEmployer = asOptionalString(body.currentEmployer);
    const source = asOptionalString(body.source) ?? "Manual";
    const notes = asOptionalString(body.notes);
    const status = normalizeStatus(asOptionalString(body.status)) ?? "new";

    if (!name) {
      return NextResponse.json({ ok: false, error: "Candidate name is required" }, { status: 400 });
    }

    if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
      return NextResponse.json({ ok: false, error: "Invalid candidate status" }, { status: 400 });
    }

    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const orgId = await getOrgIdForUser(admin, user.id);
    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Missing organization" }, { status: 500 });
    }

    const matchedPositions = positionId
      ? [
          {
            position_id: positionId,
            position_title: positionTitle,
            match_score: null,
          },
        ]
      : null;

    const insertFull = {
      organization_id: orgId,
      name,
      email,
      phone,
      license_type: licenseType,
      license_number: licenseNumber,
      experience_years: experienceYears,
      location,
      current_employer: currentEmployer,
      source,
      status,
      fit_score: 0,
      matched_positions: matchedPositions,
      raw_data: {
        manual_entry: true,
        position_id: positionId,
        position_title: positionTitle,
        notes,
      },
    };

    const insertFallback = {
      organization_id: orgId,
      name,
      email,
      phone,
      license_type: licenseType,
      license_number: licenseNumber,
      experience_years: experienceYears,
      location,
      current_employer: currentEmployer,
      source,
      status,
      fit_score: 0,
      raw_data: {
        manual_entry: true,
        position_id: positionId,
        position_title: positionTitle,
        notes,
      },
    };

    const fullResp = await admin
      .from("candidates")
      .insert(insertFull)
      .select("id,name,email,phone,license_type,license_number,experience_years,specializations,location,current_employer,source,source_url,status,fit_score,created_at")
      .maybeSingle();

    let candidate = fullResp.data;
    let insertError = fullResp.error;

    if (insertError) {
      const fallbackResp = await admin
        .from("candidates")
        .insert(insertFallback)
        .select("id,name,email,phone,license_type,license_number,experience_years,specializations,location,current_employer,source,source_url,status,fit_score,created_at")
        .maybeSingle();
      candidate = fallbackResp.data;
      insertError = fallbackResp.error;
    }

    if (insertError || !candidate) {
      return NextResponse.json({ ok: false, error: insertError?.message ?? "Failed to create candidate" }, { status: 500 });
    }

    await admin.from("activities").insert([
      {
        candidate_id: candidate.id,
        user_id: user.id,
        action: "candidate_created",
        notes: JSON.stringify({ source: "manual", status, position_id: positionId }),
      },
    ]);

    return NextResponse.json({ ok: true, candidate });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
