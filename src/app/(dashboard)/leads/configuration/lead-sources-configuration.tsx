"use client";

import * as React from "react";

import { CircleAlert, Loader2, Plus, Settings, TestTube2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type LeadSource = {
  id: string;
  parentSourceId?: string | null;
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
  totalLeads: number;
  leadsThisMonth: number;
  leadsThisWeek: number;
  avgConversionRate: number;
  avgScore: number;
  bestSource: { id: string; name: string; leadsThisWeek: number } | null;
  lastScanAt: string | null;
  lastRun:
    | {
        status: string;
        startedAt: string | null;
        completedAt: string | null;
        errorMessage: string | null;
      }
    | null;
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
  leads: {
    name: string;
    email: string;
    phone: string | null;
    location: string | null;
    source: string;
    source_url: string | null;
    raw_data?: any;
  }[];
};

function formatDateTime(val: string | null) {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

const SCAN_FREQUENCY_OPTIONS = [
  { value: "Every hour", label: "Every hour" },
  { value: "Every 4 hours", label: "Every 4 hours" },
  { value: "Every 12 hours", label: "Every 12 hours" },
  { value: "Daily", label: "Daily" },
];

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
  const [testOpen, setTestOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [testing, setTesting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [addOpen, setAddOpen] = React.useState(false);
  const [addSubmitting, setAddSubmitting] = React.useState(false);
  const [addForm, setAddForm] = React.useState({
    name: "",
    sourceType: "",
    baseUrl: "",
    scanFrequency: "Every 4 hours",
  });

  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [settingsSaving, setSettingsSaving] = React.useState(false);
  const [selected, setSelected] = React.useState<LeadSource | null>(null);
  const [editForm, setEditForm] = React.useState({
    name: "",
    baseUrl: "",
    scanFrequency: "",
    searchParametersJson: "",
  });

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
      setTestOpen(true);
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

  function openSettings(source: LeadSource) {
    setSelected(source);
    setEditForm({
      name: source.name ?? "",
      baseUrl: source.baseUrl ?? "",
      scanFrequency: source.scanFrequency ?? "",
      searchParametersJson: "",
    });
    setSettingsOpen(true);
  }

  async function saveSettings() {
    if (!selected) return;
    setSettingsSaving(true);
    setError(null);
    try {
      let searchParameters: any = undefined;
      if (editForm.searchParametersJson.trim()) {
        try {
          searchParameters = JSON.parse(editForm.searchParametersJson);
        } catch {
          throw new Error("Search parameters must be valid JSON");
        }
      }

      await patchJson<{ ok: true }>(`/api/lead-sources/${encodeURIComponent(selected.id)}`, {
        name: editForm.name,
        baseUrl: editForm.baseUrl || null,
        scanFrequency: editForm.scanFrequency || null,
        ...(searchParameters !== undefined ? { searchParameters } : {}),
      });

      setSettingsOpen(false);
      setSelected(null);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Failed to save settings");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function deleteSource() {
    if (!selected) return;
    setSettingsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/lead-sources/${encodeURIComponent(selected.id)}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error ?? `Request failed (${res.status})`);
      }

      setDeleteOpen(false);
      setSettingsOpen(false);
      setSelected(null);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete source");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function addSource() {
    setAddSubmitting(true);
    setError(null);
    try {
      await postJson<{ ok: true }>("/api/lead-sources", {
        name: addForm.name,
        sourceType: addForm.sourceType,
        baseUrl: addForm.baseUrl || null,
        scanFrequency: addForm.scanFrequency,
      });
      setAddOpen(false);
      setAddForm({ name: "", sourceType: "", baseUrl: "", scanFrequency: "Every 4 hours" });
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Failed to add source");
    } finally {
      setAddSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-lg font-semibold text-zinc-900">Lead Source Configuration</div>
          <div className="mt-1 text-sm text-zinc-600">
            Manage your lead sources, monitor performance, and run live tests.
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex flex-col items-start sm:items-end">
            <Button
              onClick={runTest}
              disabled={testing || (status ? status.remaining <= 0 : false)}
              className="w-full sm:w-auto"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}
              {testing ? "Testing..." : "Test Sources"}
            </Button>
            {status ? (
              <div className="mt-1 text-xs text-zinc-600">
                {status.remaining > 0
                  ? `${status.remaining}/${status.dailyLimit} tests remaining today`
                  : `Daily limit reached. Resets at ${formatDateTime(status.resetAt)}`}
              </div>
            ) : null}
          </div>
          <Button
            variant="outline"
            onClick={() => setAddOpen(true)}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Add New Data Source
          </Button>
        </div>
      </div>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <CircleAlert className="h-4 w-4" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-700">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-600">Total Leads</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats ? stats.totalLeads : "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-600">Leads This Month</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats ? stats.leadsThisMonth : "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-600">Average Score</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {stats ? Math.round(stats.avgScore * 10) / 10 : "—"}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-600">Best Source</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-zinc-900">{stats?.bestSource?.name || "—"}</div>
            <Badge variant="secondary">
              {stats?.bestSource ? `${stats.bestSource.leadsThisWeek} leads this week` : "No data"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-600">Last Scan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm font-medium text-zinc-900">{formatDateTime(stats?.lastScanAt ?? null)}</div>
            <div className="text-xs text-zinc-600">
              {stats?.lastRun ? `Last run: ${stats.lastRun.status}` : "Last run: —"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-900">Sources</div>
        <div className="text-xs text-zinc-600">{stats ? `${stats.enabledSources}/${stats.totalSources} enabled` : ""}</div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {loading ? (
          <Card>
            <CardHeader>
              <CardTitle>Lead Sources</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-zinc-700">Loading...</CardContent>
          </Card>
        ) : sources.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Lead Sources</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-zinc-700">No lead sources configured.</CardContent>
          </Card>
        ) : (
          sources.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-900">{s.name}</div>
                    <div className="mt-1 text-xs font-normal text-zinc-600">
                      {s.sourceType}{s.baseUrl ? ` • ${s.baseUrl}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={s.isEnabled} onCheckedChange={(v) => toggleSource(s.id, v)} disabled={testing} />
                    <button
                      type="button"
                      onClick={() => openSettings(s)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                      aria-label="Open settings"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-zinc-500">Leads this week</div>
                  <div className="mt-1 text-base font-semibold text-zinc-900">{s.leadsThisWeek}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-zinc-500">Conversion rate</div>
                  <div className="mt-1 text-base font-semibold text-zinc-900">
                    {Number.isFinite(s.conversionRate) ? `${s.conversionRate}%` : "—"}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-zinc-500">Avg score</div>
                  <div className="mt-1 text-base font-semibold text-zinc-900">{Number(s.avgScore ?? 0)}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-zinc-500">Frequency</div>
                  <div className="mt-1 text-base font-semibold text-zinc-900">{s.scanFrequency || "—"}</div>
                </div>
                <div className="col-span-2 text-xs text-zinc-600">
                  Last scan: {formatDateTime(s.lastScanAt)}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Test Results</DialogTitle>
            <DialogDescription>
              {status ? `Remaining today: ${status.remaining}/${status.dailyLimit}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-3 overflow-auto">
            {testResults && testResults.length ? (
              testResults.map((r) => (
                <div key={`${r.sourceId}-${r.id ?? "x"}`} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">{r.sourceName}</div>
                      <div className="mt-1 text-xs text-zinc-600">Leads found: {r.leadsFound}</div>
                    </div>
                    <Badge variant={r.ok ? "success" : "danger"}>{r.ok ? "Success" : "Failed"}</Badge>
                  </div>
                  {r.error ? <div className="mt-2 text-sm text-red-700">{r.error}</div> : null}
                  {r.leads?.length ? (
                    <div className="mt-3 space-y-2">
                      {r.leads.map((l, idx) => (
                        <div key={`${r.sourceId}-${idx}`} className="rounded-md bg-zinc-50 p-3 text-sm">
                          <div className="font-medium text-zinc-900">{l.name}</div>
                          <div className="mt-1 text-xs text-zinc-600">{l.email}</div>
                          {l.source_url ? (
                            <div className="mt-1 text-xs text-zinc-600">{l.source_url}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="text-sm text-zinc-600">No results yet.</div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Data Source</DialogTitle>
            <DialogDescription>Create a new lead source for your organization.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-700">Name</div>
              <Input value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-700">Source Type</div>
              <Input
                value={addForm.sourceType}
                onChange={(e) => setAddForm((p) => ({ ...p, sourceType: e.target.value }))}
                placeholder="e.g. google, facebook, directory"
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-700">Base URL</div>
              <Input
                value={addForm.baseUrl}
                onChange={(e) => setAddForm((p) => ({ ...p, baseUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-700">Scan Frequency</div>
              <Select
                value={addForm.scanFrequency}
                onChange={(e) => setAddForm((p) => ({ ...p, scanFrequency: e.target.value }))}
                options={SCAN_FREQUENCY_OPTIONS}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={addSubmitting}>
              Cancel
            </Button>
            <Button onClick={addSource} disabled={addSubmitting}>
              {addSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {addSubmitting ? "Adding..." : "Add Source"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (!open) {
            setSelected(null);
            setDeleteOpen(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Source Settings</DialogTitle>
            <DialogDescription>{selected ? selected.name : ""}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-700">Name</div>
              <Input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-700">Base URL</div>
              <Input
                value={editForm.baseUrl}
                onChange={(e) => setEditForm((p) => ({ ...p, baseUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-700">Scan Frequency</div>
              <Select
                value={editForm.scanFrequency}
                onChange={(e) => setEditForm((p) => ({ ...p, scanFrequency: e.target.value }))}
                options={SCAN_FREQUENCY_OPTIONS}
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-700">Search Parameters (JSON)</div>
              <Textarea
                value={editForm.searchParametersJson}
                onChange={(e) => setEditForm((p) => ({ ...p, searchParametersJson: e.target.value }))}
                placeholder='{"query":"..."}'
              />
            </div>

            {selected && selected.parentSourceId ? (
              <div className="text-xs text-zinc-600">
                This source is an override of a global source.
              </div>
            ) : null}
          </div>

          <DialogFooter className="justify-between">
            <Button
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
              disabled={settingsSaving || !selected}
            >
              <Trash2 className="h-4 w-4" />
              {selected?.parentSourceId ? "Delete Override" : "Delete Source"}
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setSettingsOpen(false)} disabled={settingsSaving}>
                Close
              </Button>
              <Button onClick={saveSettings} disabled={settingsSaving || !selected}>
                {settingsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {settingsSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.parentSourceId ? "Delete Override" : "Delete Source"}</DialogTitle>
            <DialogDescription>
              This will remove the source from your organization.
              {selected?.parentSourceId ? " Your org will fall back to the default global source." : ""}
              This action can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={settingsSaving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteSource} disabled={settingsSaving}>
              {settingsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {settingsSaving
                ? "Deleting..."
                : selected?.parentSourceId
                ? "Delete Override"
                : "Delete Source"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
