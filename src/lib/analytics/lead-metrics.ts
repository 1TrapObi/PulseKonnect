import { createSupabaseAdminClient } from "@/lib/db/supabase/server";

export type DateRange = { startDate: string; endDate: string };

export type OverviewCounts = {
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  convertedLeads: number;
};

export type OverviewComparison = {
  total: number; // percent change vs previous period
  new: number;
  qualified: number;
  converted: number;
};

export type LeadsBySourceRow = { source: string; total: number };

export type FunnelRow = { status: string; count: number; pct: number };

export type TrendRow = { date: string; count: number };

export type SourcePerformanceRow = {
  source: string;
  total: number;
  qualified: number;
  converted: number;
  conversionRate: number;
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

export async function getTotalLeads(userId: string, startDate: string, endDate: string) {
  const admin = createSupabaseAdminClient();
  const orgId = await getOrgIdForUser(userId);

  const { count, error } = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getStatusCount(userId: string, startDate: string, endDate: string, status: string) {
  const admin = createSupabaseAdminClient();
  const orgId = await getOrgIdForUser(userId);

  const { count, error } = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", status)
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getOverviewCounts(userId: string, startDate: string, endDate: string): Promise<OverviewCounts> {
  const [totalLeads, newLeads, qualifiedLeads, convertedLeads] = await Promise.all([
    getTotalLeads(userId, startDate, endDate),
    getStatusCount(userId, startDate, endDate, "new"),
    getStatusCount(userId, startDate, endDate, "qualified"),
    getStatusCount(userId, startDate, endDate, "converted"),
  ]);

  return { totalLeads, newLeads, qualifiedLeads, convertedLeads };
}

export async function getPeriodComparison(userId: string, current: DateRange) {
  const previous = previousPeriod(current);
  const [currCounts, prevCounts] = await Promise.all([
    getOverviewCounts(userId, current.startDate, current.endDate),
    getOverviewCounts(userId, previous.startDate, previous.endDate),
  ]);

  const periodComparison: OverviewComparison = {
    total: pctChange(currCounts.totalLeads, prevCounts.totalLeads),
    new: pctChange(currCounts.newLeads, prevCounts.newLeads),
    qualified: pctChange(currCounts.qualifiedLeads, prevCounts.qualifiedLeads),
    converted: pctChange(currCounts.convertedLeads, prevCounts.convertedLeads),
  };

  return { current: currCounts, previous: prevCounts, periodComparison };
}

export async function getLeadsBySource(userId: string, startDate: string, endDate: string): Promise<LeadsBySourceRow[]> {
  const admin = createSupabaseAdminClient();
  const orgId = await getOrgIdForUser(userId);

  const { data, error } = await admin
    .from("leads")
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

export async function getConversionFunnel(userId: string, startDate: string, endDate: string): Promise<FunnelRow[]> {
  const stages = ["new", "contacted", "qualified", "converted"];
  const counts = await Promise.all(stages.map((s) => getStatusCount(userId, startDate, endDate, s)));
  const total = counts[0] ?? 0;

  return stages.map((status, idx) => {
    const count = counts[idx] ?? 0;
    const pct = total === 0 ? 0 : count / total;
    return { status, count, pct };
  });
}

export async function getConversionRate(userId: string, startDate: string, endDate: string) {
  const [newCount, converted] = await Promise.all([
    getStatusCount(userId, startDate, endDate, "new"),
    getStatusCount(userId, startDate, endDate, "converted"),
  ]);
  if (newCount === 0) return 0;
  return converted / newCount;
}

export async function getAvgResponseTime(userId: string, startDate: string, endDate: string) {
  const admin = createSupabaseAdminClient();
  const orgId = await getOrgIdForUser(userId);

  const { data, error } = await admin
    .from("leads")
    .select("response_time_hours")
    .eq("organization_id", orgId)
    .not("response_time_hours", "is", null)
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  if (error) throw new Error(error.message);

  const vals = (data ?? [])
    .map((r: any) => Number(r.response_time_hours))
    .filter((n) => Number.isFinite(n));

  if (!vals.length) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.round(avg * 10) / 10;
}

export async function getLeadTrendDaily(userId: string, startDate: string, endDate: string): Promise<TrendRow[]> {
  const admin = createSupabaseAdminClient();
  const orgId = await getOrgIdForUser(userId);

  const { data, error } = await admin
    .from("leads")
    .select("created_at")
    .eq("organization_id", orgId)
    .gte("created_at", startDate)
    .lte("created_at", endDate)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const iso = String((row as any).created_at);
    const d = new Date(iso);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
      d.getUTCDate()
    ).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
}

export async function getSourcePerformance(userId: string, startDate: string, endDate: string): Promise<SourcePerformanceRow[]> {
  const admin = createSupabaseAdminClient();
  const orgId = await getOrgIdForUser(userId);

  const { data, error } = await admin
    .from("leads")
    .select("source,status")
    .eq("organization_id", orgId)
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  if (error) throw new Error(error.message);

  const stats = new Map<string, { total: number; qualified: number; converted: number }>();

  for (const row of data ?? []) {
    const source = String((row as any).source ?? "Unknown").trim() || "Unknown";
    const status = String((row as any).status ?? "").toLowerCase();

    const s = stats.get(source) ?? { total: 0, qualified: 0, converted: 0 };
    s.total += 1;
    if (status === "qualified") s.qualified += 1;
    if (status === "converted") s.converted += 1;
    stats.set(source, s);
  }

  return Array.from(stats.entries())
    .map(([source, s]) => ({
      source,
      total: s.total,
      qualified: s.qualified,
      converted: s.converted,
      conversionRate: s.total === 0 ? 0 : s.converted / s.total,
    }))
    .sort((a, b) => b.total - a.total);
}
