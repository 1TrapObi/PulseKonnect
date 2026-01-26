"use client";

import * as React from "react";

import { DashboardShell } from "@/components/shared/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/analytics/metric-card";
import { LeadsBySourceChart } from "@/components/analytics/leads-by-source-chart";
import { ConversionFunnelChart } from "@/components/analytics/conversion-funnel-chart";
import { LeadTrendChart } from "@/components/analytics/lead-trend-chart";
import { SourcePerformanceTable } from "@/components/analytics/source-performance-table";

type Preset = "today" | "7d" | "30d" | "thisMonth" | "lastMonth" | "custom";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function computeRange(preset: Preset, customStart: string, customEnd: string) {
  const now = new Date();

  if (preset === "today") {
    return { startDate: startOfDay(now).toISOString(), endDate: endOfDay(now).toISOString() };
  }

  if (preset === "7d" || preset === "30d") {
    const days = preset === "7d" ? 7 : 30;
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return { startDate: start.toISOString(), endDate: now.toISOString() };
  }

  if (preset === "thisMonth") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: start.toISOString(), endDate: now.toISOString() };
  }

  if (preset === "lastMonth") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { startDate: start.toISOString(), endDate: endOfDay(end).toISOString() };
  }

  const s = customStart ? new Date(customStart) : null;
  const e = customEnd ? new Date(customEnd) : null;
  if (!s || !e || Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    return { startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), endDate: now.toISOString() };
  }
  return { startDate: startOfDay(s).toISOString(), endDate: endOfDay(e).toISOString() };
}

type OverviewResponse = {
  ok: boolean;
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  convertedLeads: number;
  periodComparison: { total: number; new: number; qualified: number; converted: number };
};

type KeyMetricsResponse = {
  ok: boolean;
  avgResponseTimeHours: number | null;
  fastestResponse: { hours: number; userEmail: string | null } | null;
};

export default function LeadAnalyticsPage() {
  const [preset, setPreset] = React.useState<Preset>("7d");
  const [customStart, setCustomStart] = React.useState("");
  const [customEnd, setCustomEnd] = React.useState("");

  const [applied, setApplied] = React.useState(() => computeRange("7d", "", ""));

  const [overview, setOverview] = React.useState<OverviewResponse | null>(null);
  const [bySource, setBySource] = React.useState<any[]>([]);
  const [funnel, setFunnel] = React.useState<any[]>([]);
  const [trend, setTrend] = React.useState<any[]>([]);
  const [sourcePerf, setSourcePerf] = React.useState<any[]>([]);
  const [keyMetrics, setKeyMetrics] = React.useState<KeyMetricsResponse | null>(null);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = React.useState(false);

  const apply = React.useCallback(() => {
    setApplied(computeRange(preset, customStart, customEnd));
  }, [preset, customStart, customEnd]);

  const fetchAll = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    async function fetchJson(path: string) {
      const res = await fetch(path);
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || !json?.ok) {
        const message = json?.error ?? `Request failed (${res.status})`;
        throw new Error(message);
      }
      return json;
    }

    try {
      const params = new URLSearchParams({
        startDate: applied.startDate,
        endDate: applied.endDate,
      });

      const [o, s, f, t, sp, km] = await Promise.all([
        fetchJson(`/api/analytics/leads/overview?${params.toString()}`),
        fetchJson(`/api/analytics/leads/charts?${params.toString()}&chartType=source`),
        fetchJson(`/api/analytics/leads/charts?${params.toString()}&chartType=funnel`),
        fetchJson(`/api/analytics/leads/charts?${params.toString()}&chartType=trend`),
        fetchJson(`/api/analytics/leads/charts?${params.toString()}&chartType=sourcePerformance`),
        fetchJson(`/api/analytics/leads/key-metrics?${params.toString()}`),
      ]);

      setOverview(o as OverviewResponse);
      setBySource(o?.totalLeads ? (s.data ?? []) : []);
      setFunnel(o?.totalLeads ? (f.data ?? []) : []);
      setTrend(o?.totalLeads ? (t.data ?? []) : []);
      setSourcePerf(o?.totalLeads ? (sp.data ?? []) : []);
      setKeyMetrics(km as KeyMetricsResponse);
      setHasLoaded(true);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load analytics");
      setHasLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [applied.startDate, applied.endDate]);

  React.useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const avgResponse = keyMetrics?.avgResponseTimeHours ?? null;

  const overallConversion = React.useMemo(() => {
    const newCount = funnel.find((x: any) => x.status === "new")?.count ?? 0;
    const converted = funnel.find((x: any) => x.status === "converted")?.count ?? 0;
    if (!newCount) return { pct: 0, converted: 0, total: 0 };
    return { pct: Math.round((converted / newCount) * 100), converted, total: newCount };
  }, [funnel]);

  const topSource = React.useMemo(() => {
    if (!sourcePerf.length) return null;
    const best = [...sourcePerf].sort((a: any, b: any) => (b.conversionRate ?? 0) - (a.conversionRate ?? 0))[0];
    return best ? `${best.source} (${Math.round((best.conversionRate ?? 0) * 100)}% conversion)` : null;
  }, [sourcePerf]);

  const totalLeads = overview?.totalLeads ?? 0;
  const showEmptyState = hasLoaded && !loading && !error && totalLeads === 0;

  async function exportCsv() {
    if (!totalLeads) return;
    const params = new URLSearchParams({ startDate: applied.startDate, endDate: applied.endDate });
    const res = await fetch(`/api/analytics/leads/export?${params.toString()}`);
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as any;
      setError(json?.error ?? `Export failed (${res.status})`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads_export.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <DashboardShell title="Lead Analytics">
      <div className="space-y-4">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <div className="font-semibold">We couldn’t load analytics</div>
            <div className="mt-1 text-red-800">{error}</div>
            <div className="mt-3">
              <Button type="button" variant="outline" onClick={fetchAll} disabled={loading}>
                {loading ? "Retrying…" : "Retry"}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-4">
          {loading && !hasLoaded ? (
            <>
              <div className="h-[84px] animate-pulse rounded-xl border bg-white" />
              <div className="h-[84px] animate-pulse rounded-xl border bg-white" />
              <div className="h-[84px] animate-pulse rounded-xl border bg-white" />
              <div className="h-[84px] animate-pulse rounded-xl border bg-white" />
            </>
          ) : (
            <>
              <MetricCard
                title="Total Leads"
                value={overview?.totalLeads ?? 0}
                change={overview?.periodComparison?.total ?? 0}
              />
              <MetricCard
                title="New Leads"
                value={overview?.newLeads ?? 0}
                change={overview?.periodComparison?.new ?? 0}
              />
              <MetricCard
                title="Qualified Leads"
                value={overview?.qualifiedLeads ?? 0}
                change={overview?.periodComparison?.qualified ?? 0}
              />
              <MetricCard
                title="Converted Leads"
                value={overview?.convertedLeads ?? 0}
                change={overview?.periodComparison?.converted ?? 0}
              />
            </>
          )}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Date range</CardTitle>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={exportCsv} disabled={loading || !totalLeads}>
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-12">
              <div className="md:col-span-4">
                <select
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm"
                  value={preset}
                  onChange={(e) => setPreset(e.target.value as Preset)}
                >
                  <option value="today">Today</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="thisMonth">This month</option>
                  <option value="lastMonth">Last month</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {preset === "custom" ? (
                <>
                  <div className="md:col-span-3">
                    <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                  </div>
                  <div className="md:col-span-3">
                    <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                  </div>
                </>
              ) : null}

              <div className="md:col-span-2">
                <Button type="button" onClick={() => {
                  apply();
                  // apply changes trigger refetch via applied state update
                }} disabled={loading}>
                  {loading ? "Loading…" : "Apply"}
                </Button>
              </div>
            </div>
            <div className="mt-2 text-xs text-zinc-600">
              Applied: {applied.startDate.slice(0, 10)} → {applied.endDate.slice(0, 10)}
            </div>
          </CardContent>
        </Card>

        {showEmptyState ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-zinc-700">
            <div className="text-base font-semibold text-zinc-900">No leads found in this date range</div>
            <div className="mt-1 text-zinc-600">
              Try expanding the date range, or create a few leads to start tracking performance.
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {loading && !hasLoaded ? (
            <>
              <div className="h-[360px] animate-pulse rounded-xl border bg-white" />
              <div className="h-[360px] animate-pulse rounded-xl border bg-white" />
            </>
          ) : (
            <>
              <LeadsBySourceChart data={bySource} />
              <ConversionFunnelChart data={funnel} />
            </>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {loading && !hasLoaded ? (
            <>
              <div className="h-[360px] animate-pulse rounded-xl border bg-white" />
              <div className="h-[360px] animate-pulse rounded-xl border bg-white" />
            </>
          ) : (
            <>
              <LeadTrendChart data={trend} />
              <SourcePerformanceTable data={sourcePerf} />
            </>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Key Metrics</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border bg-white p-3">
              <div className="text-xs text-zinc-600">Average Response Time</div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">
                {avgResponse == null ? "—" : `${avgResponse} hours`}
              </div>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="text-xs text-zinc-600">Overall Conversion Rate</div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">
                {overallConversion.pct}% ({overallConversion.converted} of {overallConversion.total || 0})
              </div>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="text-xs text-zinc-600">Top Performing Source</div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">{topSource ?? "—"}</div>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="text-xs text-zinc-600">Fastest Response</div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">
                {keyMetrics?.fastestResponse
                  ? `${keyMetrics.fastestResponse.hours} hours${
                      keyMetrics.fastestResponse.userEmail
                        ? ` (${keyMetrics.fastestResponse.userEmail})`
                        : ""
                    }`
                  : "—"}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
