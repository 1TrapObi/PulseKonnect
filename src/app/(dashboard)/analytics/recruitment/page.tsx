"use client";

import * as React from "react";

import { DashboardShell } from "@/components/shared/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/analytics/metric-card";
import {
  CandidatesBySourceChart,
  CandidateTrendChart,
  FitScoreDistributionChart,
  HiresByPositionChart,
  PipelineFunnelChart,
  PositionPerformanceTable,
  TimeToHireChart,
} from "@/components/analytics/recruitment";

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
    return {
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: now.toISOString(),
    };
  }

  return { startDate: startOfDay(s).toISOString(), endDate: endOfDay(e).toISOString() };
}

type OverviewResponse = {
  ok: boolean;
  totalCandidates: number;
  qualifiedCandidates: number;
  interviewsScheduled: number;
  hiresMade: number;
  periodComparison: {
    totalCandidates: number;
    qualifiedCandidates: number;
    interviewsScheduled: number;
    hiresMade: number;
  };
  error?: string;
};

type ChartsResponse = { ok: boolean; chartType: string; data: any[]; error?: string };

type MetricsResponse = {
  ok: boolean;
  conversionRates: {
    interviewToHireRate: number;
    offerAcceptanceRate: number;
    overallConversionRate: number;
    interviewed: number;
    offers: number;
    hired: number;
    new: number;
  };
  sourcePerformance: any[];
  positionPerformance: any[];
  error?: string;
};

export default function RecruitmentAnalyticsPage() {
  const [preset, setPreset] = React.useState<Preset>("7d");
  const [customStart, setCustomStart] = React.useState("");
  const [customEnd, setCustomEnd] = React.useState("");

  const [applied, setApplied] = React.useState(() => computeRange("7d", "", ""));

  const [overview, setOverview] = React.useState<OverviewResponse | null>(null);
  const [bySource, setBySource] = React.useState<any[]>([]);
  const [funnel, setFunnel] = React.useState<any[]>([]);
  const [fitDist, setFitDist] = React.useState<any[]>([]);
  const [trend, setTrend] = React.useState<any[]>([]);
  const [hiresByPos, setHiresByPos] = React.useState<any[]>([]);
  const [timeToHire, setTimeToHire] = React.useState<any[]>([]);
  const [metrics, setMetrics] = React.useState<MetricsResponse | null>(null);

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
      const params = new URLSearchParams({ startDate: applied.startDate, endDate: applied.endDate });

      const [o, s, f, fd, t, hp, th, m] = await Promise.all([
        fetchJson(`/api/analytics/recruitment/overview?${params.toString()}`),
        fetchJson(`/api/analytics/recruitment/charts?${params.toString()}&chartType=source`),
        fetchJson(`/api/analytics/recruitment/charts?${params.toString()}&chartType=funnel`),
        fetchJson(`/api/analytics/recruitment/charts?${params.toString()}&chartType=fitDistribution`),
        fetchJson(`/api/analytics/recruitment/charts?${params.toString()}&chartType=trend`),
        fetchJson(`/api/analytics/recruitment/charts?${params.toString()}&chartType=hiresByPosition`),
        fetchJson(`/api/analytics/recruitment/charts?${params.toString()}&chartType=timeToHire`),
        fetchJson(`/api/analytics/recruitment/metrics?${params.toString()}`),
      ]);

      setOverview(o as OverviewResponse);
      setBySource((s as ChartsResponse).data ?? []);
      setFunnel((f as ChartsResponse).data ?? []);
      setFitDist((fd as ChartsResponse).data ?? []);
      setTrend((t as ChartsResponse).data ?? []);
      setHiresByPos((hp as ChartsResponse).data ?? []);
      setTimeToHire((th as ChartsResponse).data ?? []);
      setMetrics(m as MetricsResponse);

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

  const total = overview?.totalCandidates ?? 0;
  const showEmptyState = hasLoaded && !loading && !error && total === 0;

  async function exportCsv(exportType: "candidates" | "positions" | "summary") {
    if (!hasLoaded) return;
    const params = new URLSearchParams({
      startDate: applied.startDate,
      endDate: applied.endDate,
      exportType,
    });

    const res = await fetch(`/api/analytics/recruitment/export?${params.toString()}`);
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as any;
      setError(json?.error ?? `Export failed (${res.status})`);
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      exportType === "candidates"
        ? "recruitment_candidates_export.csv"
        : exportType === "positions"
        ? "recruitment_positions_export.csv"
        : "recruitment_summary_export.csv";

    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const keyMetrics = React.useMemo(() => {
    const conv = metrics?.conversionRates;
    if (!conv) {
      return {
        avgTimeToHire: null as number | null,
        interviewToHire: null as string | null,
        offerAcceptance: null as string | null,
        overallConv: null as string | null,
      };
    }

    return {
      avgTimeToHire: null as number | null, // computed later
      interviewToHire: `${Math.round((conv.interviewToHireRate ?? 0) * 1000) / 10}% (${conv.hired} of ${conv.interviewed})`,
      offerAcceptance: `${Math.round((conv.offerAcceptanceRate ?? 0) * 1000) / 10}% (${conv.hired} of ${conv.offers})`,
      overallConv: `${Math.round((conv.overallConversionRate ?? 0) * 1000) / 10}% (${conv.hired} of ${conv.new})`,
    };
  }, [metrics]);

  return (
    <DashboardShell title="Recruitment Metrics">
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
              <MetricCard title="Total Candidates" value={overview?.totalCandidates ?? 0} change={overview?.periodComparison?.totalCandidates ?? 0} />
              <MetricCard title="Qualified Candidates" value={overview?.qualifiedCandidates ?? 0} change={overview?.periodComparison?.qualifiedCandidates ?? 0} />
              <MetricCard title="Interviews Scheduled" value={overview?.interviewsScheduled ?? 0} change={overview?.periodComparison?.interviewsScheduled ?? 0} />
              <MetricCard title="Hires Made" value={overview?.hiresMade ?? 0} change={overview?.periodComparison?.hiresMade ?? 0} />
            </>
          )}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Date range</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => exportCsv("candidates")} disabled={loading}>
                Export Candidates
              </Button>
              <Button type="button" variant="outline" onClick={() => exportCsv("positions")} disabled={loading}>
                Export Positions
              </Button>
              <Button type="button" variant="outline" onClick={() => exportCsv("summary")} disabled={loading}>
                Export Summary
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
                <Button
                  type="button"
                  onClick={() => {
                    apply();
                  }}
                  disabled={loading}
                >
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
            <div className="text-base font-semibold text-zinc-900">No candidates found in this date range</div>
            <div className="mt-1 text-zinc-600">Try expanding the date range, or add candidates to start tracking.</div>
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
              <CandidatesBySourceChart data={bySource} />
              <PipelineFunnelChart data={funnel} />
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
              <TimeToHireChart data={timeToHire} />
              <FitScoreDistributionChart data={fitDist} />
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
              <HiresByPositionChart data={hiresByPos} />
              <CandidateTrendChart data={trend} />
            </>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Key Metrics</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-white p-3">
              <div className="text-xs text-zinc-600">Interview-to-Hire Rate</div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">{keyMetrics.interviewToHire ?? "—"}</div>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="text-xs text-zinc-600">Offer Acceptance Rate</div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">{keyMetrics.offerAcceptance ?? "—"}</div>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="text-xs text-zinc-600">Overall Conversion Rate</div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">{keyMetrics.overallConv ?? "—"}</div>
            </div>
          </CardContent>
        </Card>

        <PositionPerformanceTable data={(metrics?.positionPerformance ?? []) as any} />
      </div>
    </DashboardShell>
  );
}
