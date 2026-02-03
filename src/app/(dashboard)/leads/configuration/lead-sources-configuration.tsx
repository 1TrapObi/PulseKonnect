"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LeadSource = {
  id: string;
  name: string;
  sourceType: string;
  baseUrl: string | null;
  isActive: boolean;
  isEnabled: boolean;
  scanFrequency: string;
  leadsThisWeek: number;
  conversionRate: number;
  avgScore: number;
  lastScanAt: string | null;
  nextScanAt: string | null;
};

type Stats = {
  totalSources: number;
  enabledSources: number;
  leadsThisWeek: number;
  avgConversionRate: number;
  avgScore: number;
};

type TestStatus = {
  dailyLimit: number;
  used: number;
  remaining: number;
  resetAt: string;
  lastTestAt: string | null;
};

type TestResult = {
  id: string | null;
  createdAt: string | null;
  sourceId: string;
  sourceName: string;
  ok: boolean;
  error?: string;
  leadsFound: number;
  leads: any[];
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "GET" });
  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error ?? `Request failed (${res.status})`);
  }
  return json as T;
}

async function postJson<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || json?.ok === false) {
    const msg = json?.error ?? `Request failed (${res.status})`;
    const err: any = new Error(msg);
    (err.status = res.status), (err.payload = json);
    throw err;
  }
  return json as T;
}

async function patchJson<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error ?? `Request failed (${res.status})`);
  }
  return json as T;
}

export function LeadSourcesConfiguration() {
  const [sources, setSources] = React.useState<LeadSource[]>([]);
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [status, setStatus] = React.useState<TestStatus | null>(null);
  const [testResults, setTestResults] = React.useState<TestResult[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [testing, setTesting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function refresh() {
    setError(null);
    setLoading(true);
    try {
      const [srcRes, statRes, statusRes] = await Promise.all([
        getJson<{ ok: true; sources: LeadSource[] }>("/api/lead-sources"),
        getJson<{ ok: true } & Stats>("/api/lead-sources/statistics"),
        getJson<{ ok: true } & TestStatus>("/api/lead-sources/test/status"),
      ]);
      setSources(srcRes.sources ?? []);
      setStats(statRes as any);
      setStatus(statusRes as any);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load lead sources");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    refresh();
  }, []);

  async function toggleSource(id: string, isEnabled: boolean) {
    setError(null);
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, isEnabled } : s)));
    try {
      await patchJson<{ ok: true }>(`/api/lead-sources/${encodeURIComponent(id)}/toggle`, { isEnabled });
    } catch (e: any) {
      setSources((prev) => prev.map((s) => (s.id === id ? { ...s, isEnabled: !isEnabled } : s)));
      setError(e?.message ?? "Failed to update source");
    } finally {
      await refresh();
    }
  }

  async function runTest() {
    setError(null);
    setTesting(true);
    setTestResults(null);
    try {
      const res = await postJson<{ ok: true; results: TestResult[] } & TestStatus>("/api/lead-sources/test", {
        testAllEnabled: true,
      });
      setTestResults(res.results ?? []);
      setStatus({
        dailyLimit: res.dailyLimit,
        used: res.used,
        remaining: res.remaining,
        resetAt: res.resetAt,
        lastTestAt: new Date().toISOString(),
      });
    } catch (e: any) {
      setError(e?.message ?? "Test failed");
    } finally {
      setTesting(false);
      await refresh();
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-700">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sources</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats ? stats.totalSources : "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Enabled</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats ? stats.enabledSources : "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Leads This Week</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats ? stats.leadsThisWeek : "—"}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <span>Test Sources</span>
            <span className="text-sm font-normal text-zinc-600">
              {status ? `${status.remaining}/${status.dailyLimit} tests remaining today` : "—"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div>
            <Button onClick={runTest} disabled={testing || (status ? status.remaining <= 0 : false)}>
              {testing ? "Testing..." : "Test Enabled Sources"}
            </Button>
          </div>

          {testResults ? (
            <div className="space-y-2">
              {testResults.map((r) => (
                <div key={`${r.sourceId}-${r.id ?? "x"}`} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{r.sourceName}</div>
                    <div className={r.ok ? "text-green-700" : "text-red-700"}>{r.ok ? "OK" : "Failed"}</div>
                  </div>
                  <div className="mt-1 text-zinc-700">Leads found: {r.leadsFound}</div>
                  {r.error ? <div className="mt-1 text-red-700">{r.error}</div> : null}
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {loading ? (
          <Card>
            <CardHeader>
              <CardTitle>Lead Sources</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-zinc-700">Loading...</CardContent>
          </Card>
        ) : (
          sources.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <span>{s.name}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={s.isEnabled ? "default" : "outline"}
                      onClick={() => toggleSource(s.id, !s.isEnabled)}
                      disabled={testing}
                    >
                      {s.isEnabled ? "Enabled" : "Disabled"}
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-zinc-500">Type</div>
                  <div className="font-medium">{s.sourceType}</div>
                </div>
                <div>
                  <div className="text-zinc-500">Frequency</div>
                  <div className="font-medium">{s.scanFrequency || "—"}</div>
                </div>
                <div>
                  <div className="text-zinc-500">Leads this week</div>
                  <div className="font-medium">{s.leadsThisWeek}</div>
                </div>
                <div>
                  <div className="text-zinc-500">Conversion rate</div>
                  <div className="font-medium">{Number.isFinite(s.conversionRate) ? `${s.conversionRate}%` : "—"}</div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
