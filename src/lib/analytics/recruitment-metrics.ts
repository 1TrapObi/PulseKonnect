import { createSupabaseAdminClient } from "@/lib/db/supabase/server";

export type DateRange = { startDate: string; endDate: string };

export type RecruitmentOverviewCounts = {
  totalCandidates: number;
  qualifiedCandidates: number;
  interviewsScheduled: number;
  hiresMade: number;
};

export type RecruitmentOverviewComparison = {
  totalCandidates: number; // percent change vs previous period
  qualifiedCandidates: number;
  interviewsScheduled: number;
  hiresMade: number;
};

export type CandidatesBySourceRow = { source: string; total: number };

export type FunnelRow = { status: string; count: number; pct: number };

export type TrendRow = { date: string; count: number };

export type FitBucket = "excellent" | "good" | "fair" | "poor";
export type FitDistributionRow = { bucket: FitBucket; label: string; count: number; pct: number; color: string };

export type HiresByPositionRow = { positionId: string; title: string; hires: number };

export type TimeToHireByPositionRow = { positionId: string; title: string; avgDays: number | null };

export type ConversionRates = {
  interviewToHireRate: number; // fraction 0..1
  offerAcceptanceRate: number; // hired / offer
  overallConversionRate: number; // hired / new
  interviewed: number;
  offers: number;
  hired: number;
  new: number;
};

export type SourcePerformanceRow = {
  source: string;
  totalCandidates: number;
  qualified: number;
  hired: number;
  avgFitScore: number | null;
  hireRate: number;
};

export type PositionPerformanceRow = {
  positionId: string;
  title: string;
  status: string | null;
  totalCandidates: number;
  qualifiedCandidates: number;
  inInterview: number;
  offers: number;
  hires: number;
  daysToFill: number | null;
  conversionRate: number; // hires / total candidates
};

export function pctChange(current: number, previous: number) {
  if (previous === 0) {
    if (current === 0) return 0;
    return 1;
  }
  return (current - previous) / previous;
}

export function previousPeriod(range: DateRange): DateRange {
  const start = new Date(range.startDate);
  const end = new Date(range.endDate);
  const ms = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime());
  const prevStart = new Date(start.getTime() - ms);
  return { startDate: prevStart.toISOString(), endDate: prevEnd.toISOString() };
}

async function getOrgIdForUser(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data?.organization_id) {
    throw new Error(error?.message ?? "Missing organization");
  }
  return String((data as any).organization_id);
}

function safeJsonParse(v: any) {
  if (v == null) return null;
  try {
    return typeof v === "string" ? JSON.parse(v) : v;
  } catch {
    return null;
  }
}

function dateKeyUtc(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(
    2,
    "0"
  )}`;
}

export async function getTotalCandidates(userId: string, startDate: string, endDate: string) {
  const admin = createSupabaseAdminClient();
  const orgId = await getOrgIdForUser(userId);

  const { count, error } = await admin
    .from("candidates")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countCandidatesByFitScore(userId: string, startDate: string, endDate: string, minFit: number) {
  const admin = createSupabaseAdminClient();
  const orgId = await getOrgIdForUser(userId);

  const { count, error } = await admin
    .from("candidates")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .gte("created_at", startDate)
    .lte("created_at", endDate)
    .gte("fit_score", minFit);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countCandidatesByQualificationStatus(
  userId: string,
  startDate: string,
  endDate: string,
  statuses: string[]
) {
  const admin = createSupabaseAdminClient();
  const orgId = await getOrgIdForUser(userId);

  const { count, error } = await admin
    .from("candidates")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .gte("created_at", startDate)
    .lte("created_at", endDate)
    .in("qualification_status", statuses);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getQualifiedCandidates(userId: string, startDate: string, endDate: string) {
  // Prefer qualification_status if present; fall back to fit_score.
  try {
    return await countCandidatesByQualificationStatus(userId, startDate, endDate, ["excellent", "good"]);
  } catch {
    return await countCandidatesByFitScore(userId, startDate, endDate, 60);
  }
}

export async function getInterviewsScheduled(userId: string, startDate: string, endDate: string) {
  const admin = createSupabaseAdminClient();
  const orgId = await getOrgIdForUser(userId);

  // Interviews are linked to candidates; scope by org through candidate_ids.
  const { data: candIds, error: cErr } = await admin
    .from("candidates")
    .select("id")
    .eq("organization_id", orgId)
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  if (cErr) throw new Error(cErr.message);
  const ids = (candIds ?? []).map((r: any) => String(r.id)).filter(Boolean);
  if (!ids.length) return 0;

  const { count, error } = await admin
    .from("interviews")
    .select("id", { count: "exact", head: true })
    .in("candidate_id", ids)
    .gte("interview_date", startDate)
    .lte("interview_date", endDate);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getHiresMade(userId: string, startDate: string, endDate: string) {
  const admin = createSupabaseAdminClient();
  const orgId = await getOrgIdForUser(userId);

  // Prefer activities that record status transitions.
  try {
    const { data: activities, error } = await admin
      .from("activities")
      .select("candidate_id,action,notes,created_at")
      .eq("action", "candidate_status_changed")
      .not("candidate_id", "is", null)
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (error) throw new Error(error.message);

    const hired = new Set<string>();
    for (const a of activities ?? []) {
      const notes = safeJsonParse((a as any).notes);
      if (notes?.to === "hired") {
        hired.add(String((a as any).candidate_id));
      }
    }

    if (hired.size) {
      // ensure org scoping
      const { data: c } = await admin
        .from("candidates")
        .select("id")
        .eq("organization_id", orgId)
        .in("id", Array.from(hired));

      return (c ?? []).length;
    }

    return 0;
  } catch {
    // Fall back: hired candidates updated in range.
    const { count, error } = await admin
      .from("candidates")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "hired")
      .gte("updated_at", startDate)
      .lte("updated_at", endDate);

    if (error) throw new Error(error.message);
    return count ?? 0;
  }
}

export async function getOverviewCounts(userId: string, startDate: string, endDate: string): Promise<RecruitmentOverviewCounts> {
  const [totalCandidates, qualifiedCandidates, interviewsScheduled, hiresMade] = await Promise.all([
    getTotalCandidates(userId, startDate, endDate),
    getQualifiedCandidates(userId, startDate, endDate),
    getInterviewsScheduled(userId, startDate, endDate),
    getHiresMade(userId, startDate, endDate),
  ]);

  return { totalCandidates, qualifiedCandidates, interviewsScheduled, hiresMade };
}

export async function getPeriodComparison(userId: string, current: DateRange) {
  const previous = previousPeriod(current);

  const [currCounts, prevCounts] = await Promise.all([
    getOverviewCounts(userId, current.startDate, current.endDate),
    getOverviewCounts(userId, previous.startDate, previous.endDate),
  ]);

  const periodComparison: RecruitmentOverviewComparison = {
    totalCandidates: pctChange(currCounts.totalCandidates, prevCounts.totalCandidates),
    qualifiedCandidates: pctChange(currCounts.qualifiedCandidates, prevCounts.qualifiedCandidates),
    interviewsScheduled: pctChange(currCounts.interviewsScheduled, prevCounts.interviewsScheduled),
    hiresMade: pctChange(currCounts.hiresMade, prevCounts.hiresMade),
  };

  return { current: currCounts, previous: prevCounts, periodComparison };
}

export async function getCandidatesBySource(userId: string, startDate: string, endDate: string): Promise<CandidatesBySourceRow[]> {
  const admin = createSupabaseAdminClient();
  const orgId = await getOrgIdForUser(userId);

  const { data, error } = await admin
    .from("candidates")
    .select("source")
    .eq("organization_id", orgId)
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  if (error) throw new Error(error.message);

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const src = String((row as any).source ?? "Unknown").trim() || "Unknown";
    map.set(src, (map.get(src) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([source, total]) => ({ source, total }))
    .sort((a, b) => b.total - a.total);
}

export async function getPipelineFunnel(userId: string, startDate: string, endDate: string): Promise<FunnelRow[]> {
  const admin = createSupabaseAdminClient();
  const orgId = await getOrgIdForUser(userId);

  const stages = ["new", "screening", "interview", "offer", "hired"];

  const { data, error } = await admin
    .from("candidates")
    .select("status")
    .eq("organization_id", orgId)
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  for (const s of stages) counts.set(s, 0);
  for (const row of data ?? []) {
    const s = String((row as any).status ?? "").toLowerCase();
    if (counts.has(s)) counts.set(s, (counts.get(s) ?? 0) + 1);
  }

  const total = counts.get("new") ?? 0;
  return stages.map((status) => {
    const count = counts.get(status) ?? 0;
    const pct = total === 0 ? 0 : count / total;
    return { status, count, pct };
  });
}

export async function getFitScoreDistribution(userId: string, startDate: string, endDate: string): Promise<FitDistributionRow[]> {
  const admin = createSupabaseAdminClient();
  const orgId = await getOrgIdForUser(userId);

  const { data, error } = await admin
    .from("candidates")
    .select("fit_score")
    .eq("organization_id", orgId)
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  if (error) throw new Error(error.message);

  const buckets: Record<FitBucket, number> = { excellent: 0, good: 0, fair: 0, poor: 0 };
  for (const row of data ?? []) {
    const fs = Number((row as any).fit_score);
    if (!Number.isFinite(fs)) continue;
    if (fs >= 75) buckets.excellent += 1;
    else if (fs >= 60) buckets.good += 1;
    else if (fs >= 40) buckets.fair += 1;
    else buckets.poor += 1;
  }

  const total = (Object.values(buckets) as number[]).reduce((a, b) => a + b, 0);

  const rows: FitDistributionRow[] = [
    { bucket: "excellent", label: "Excellent Fit (75+)", count: buckets.excellent, pct: total ? buckets.excellent / total : 0, color: "#10B981" },
    { bucket: "good", label: "Good Fit (60-74)", count: buckets.good, pct: total ? buckets.good / total : 0, color: "#3B82F6" },
    { bucket: "fair", label: "Fair Fit (40-59)", count: buckets.fair, pct: total ? buckets.fair / total : 0, color: "#F59E0B" },
    { bucket: "poor", label: "Poor Fit (<40)", count: buckets.poor, pct: total ? buckets.poor / total : 0, color: "#6B7280" },
  ];

  return rows;
}

export async function getCandidateTrendDaily(userId: string, startDate: string, endDate: string): Promise<TrendRow[]> {
  const admin = createSupabaseAdminClient();
  const orgId = await getOrgIdForUser(userId);

  const { data, error } = await admin
    .from("candidates")
    .select("created_at")
    .eq("organization_id", orgId)
    .gte("created_at", startDate)
    .lte("created_at", endDate)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const key = dateKeyUtc(String((row as any).created_at));
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
}

export async function getSourcePerformance(userId: string, startDate: string, endDate: string): Promise<SourcePerformanceRow[]> {
  const admin = createSupabaseAdminClient();
  const orgId = await getOrgIdForUser(userId);

  const { data, error } = await admin
    .from("candidates")
    .select("source,fit_score,status,qualification_status")
    .eq("organization_id", orgId)
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  if (error) throw new Error(error.message);

  const stats = new Map<
    string,
    { total: number; qualified: number; hired: number; fitSum: number; fitCount: number }
  >();

  for (const row of data ?? []) {
    const source = String((row as any).source ?? "Unknown").trim() || "Unknown";
    const status = String((row as any).status ?? "").toLowerCase();
    const q = String((row as any).qualification_status ?? "").toLowerCase();
    const fit = Number((row as any).fit_score);

    const s = stats.get(source) ?? { total: 0, qualified: 0, hired: 0, fitSum: 0, fitCount: 0 };
    s.total += 1;

    if (q === "excellent" || q === "good") {
      s.qualified += 1;
    } else if (!q && Number.isFinite(fit) && fit >= 60) {
      s.qualified += 1;
    }

    if (status === "hired") s.hired += 1;

    if (Number.isFinite(fit)) {
      s.fitSum += fit;
      s.fitCount += 1;
    }

    stats.set(source, s);
  }

  return Array.from(stats.entries())
    .map(([source, s]) => ({
      source,
      totalCandidates: s.total,
      qualified: s.qualified,
      hired: s.hired,
      avgFitScore: s.fitCount ? Math.round((s.fitSum / s.fitCount) * 10) / 10 : null,
      hireRate: s.total ? s.hired / s.total : 0,
    }))
    .sort((a, b) => b.totalCandidates - a.totalCandidates);
}

export async function getConversionRates(userId: string, startDate: string, endDate: string): Promise<ConversionRates> {
  const admin = createSupabaseAdminClient();
  const orgId = await getOrgIdForUser(userId);

  const { data, error } = await admin
    .from("candidates")
    .select("status")
    .eq("organization_id", orgId)
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  if (error) throw new Error(error.message);

  let newCount = 0;
  let interviewed = 0;
  let offers = 0;
  let hired = 0;

  for (const row of data ?? []) {
    const s = String((row as any).status ?? "").toLowerCase();
    if (s === "new") newCount += 1;
    if (s === "interview") interviewed += 1;
    if (s === "offer") offers += 1;
    if (s === "hired") hired += 1;
  }

  const interviewToHireRate = interviewed ? hired / interviewed : 0;
  const offerAcceptanceRate = offers ? hired / offers : 0;
  const overallConversionRate = newCount ? hired / newCount : 0;

  return {
    interviewToHireRate,
    offerAcceptanceRate,
    overallConversionRate,
    interviewed,
    offers,
    hired,
    new: newCount,
  };
}

export async function getPositionPerformance(userId: string, startDate: string, endDate: string): Promise<PositionPerformanceRow[]> {
  const admin = createSupabaseAdminClient();
  const orgId = await getOrgIdForUser(userId);

  const { data: positions, error: pErr } = await admin
    .from("positions")
    .select("id,title,status,posted_date,filled_date")
    .eq("organization_id", orgId)
    .gte("posted_date", startDate.slice(0, 10));

  if (pErr) throw new Error(pErr.message);

  const posList = (positions ?? []).map((p: any) => ({
    id: String(p.id),
    title: String(p.title ?? p.id),
    status: p.status ? String(p.status) : null,
    posted_date: p.posted_date ? String(p.posted_date) : null,
    filled_date: p.filled_date ? String(p.filled_date) : null,
  }));

  if (!posList.length) return [];

  const positionIds = posList.map((p) => p.id);

  const { data: matches, error: mErr } = await admin
    .from("candidate_position_matches")
    .select("candidate_id,position_id")
    .in("position_id", positionIds);

  if (mErr) throw new Error(mErr.message);

  const candidateIds = Array.from(
    new Set((matches ?? []).map((m: any) => String(m.candidate_id ?? "")).filter(Boolean))
  );

  let candidates: any[] = [];
  if (candidateIds.length) {
    const { data: c, error: cErr } = await admin
      .from("candidates")
      .select("id,status,fit_score,qualification_status")
      .eq("organization_id", orgId)
      .in("id", candidateIds);

    if (cErr) throw new Error(cErr.message);
    candidates = c ?? [];
  }

  const candById = new Map<string, any>();
  candidates.forEach((c: any) => candById.set(String(c.id), c));

  const statsByPos = new Map<
    string,
    { total: number; qualified: number; interview: number; offer: number; hired: number }
  >();

  for (const m of matches ?? []) {
    const pid = String((m as any).position_id ?? "");
    const cid = String((m as any).candidate_id ?? "");
    if (!pid || !cid) continue;

    const c = candById.get(cid);
    if (!c) continue;

    const s = statsByPos.get(pid) ?? { total: 0, qualified: 0, interview: 0, offer: 0, hired: 0 };
    s.total += 1;

    const status = String(c.status ?? "").toLowerCase();
    const q = String(c.qualification_status ?? "").toLowerCase();
    const fit = Number(c.fit_score);

    if (q === "excellent" || q === "good") {
      s.qualified += 1;
    } else if (!q && Number.isFinite(fit) && fit >= 60) {
      s.qualified += 1;
    }

    if (status === "interview") s.interview += 1;
    if (status === "offer") s.offer += 1;
    if (status === "hired") s.hired += 1;

    statsByPos.set(pid, s);
  }

  function daysBetween(start: string, end: string) {
    const s = new Date(start);
    const e = new Date(end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
    return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  }

  return posList
    .map((p) => {
      const s = statsByPos.get(p.id) ?? { total: 0, qualified: 0, interview: 0, offer: 0, hired: 0 };
      const daysToFill = p.status === "filled" && p.posted_date && p.filled_date ? daysBetween(p.posted_date, p.filled_date) : null;
      const conversionRate = s.total ? s.hired / s.total : 0;
      return {
        positionId: p.id,
        title: p.title,
        status: p.status,
        totalCandidates: s.total,
        qualifiedCandidates: s.qualified,
        inInterview: s.interview,
        offers: s.offer,
        hires: s.hired,
        daysToFill,
        conversionRate,
      };
    })
    .sort((a, b) => b.totalCandidates - a.totalCandidates);
}

export async function getHiresByPosition(userId: string, startDate: string, endDate: string): Promise<HiresByPositionRow[]> {
  const perf = await getPositionPerformance(userId, startDate, endDate);
  return perf
    .map((p) => ({ positionId: p.positionId, title: p.title, hires: p.hires }))
    .filter((x) => x.hires > 0)
    .sort((a, b) => b.hires - a.hires);
}

export async function getTimeToHireByPosition(userId: string, startDate: string, endDate: string): Promise<TimeToHireByPositionRow[]> {
  const admin = createSupabaseAdminClient();
  const orgId = await getOrgIdForUser(userId);

  const { data: positions, error } = await admin
    .from("positions")
    .select("id,title,posted_date,filled_date,status")
    .eq("organization_id", orgId)
    .gte("posted_date", startDate.slice(0, 10));

  if (error) throw new Error(error.message);

  function daysBetween(start: string, end: string) {
    const s = new Date(start);
    const e = new Date(end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
    return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  }

  return (positions ?? [])
    .map((p: any) => {
      const avgDays =
        String(p.status ?? "").toLowerCase() === "filled" && p.posted_date && p.filled_date
          ? daysBetween(String(p.posted_date), String(p.filled_date))
          : null;
      return { positionId: String(p.id), title: String(p.title ?? p.id), avgDays };
    })
    .sort((a, b) => (b.avgDays ?? -1) - (a.avgDays ?? -1));
}
