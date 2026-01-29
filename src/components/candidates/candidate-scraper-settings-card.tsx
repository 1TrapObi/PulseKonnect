"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { CANDIDATE_SOURCES, HIRING_VOLUMES } from "@/lib/constants/onboarding";

type CandidateScraperSettings = {
  candidateSources: string[];
  hiringVolume: string;
};

function normalizeSources(input: any): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((x) => String(x)).map((x) => x.trim()).filter(Boolean);
}

export function CandidateScraperSettingsCard() {
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [settings, setSettings] = React.useState<CandidateScraperSettings | null>(null);
  const [baseline, setBaseline] = React.useState<CandidateScraperSettings | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const dirty = React.useMemo(() => {
    if (!settings || !baseline) return false;
    return JSON.stringify(settings) !== JSON.stringify(baseline);
  }, [settings, baseline]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/candidate-scraper");
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Failed to load candidate scraper settings");
        return;
      }

      const s = (json.settings ?? {}) as any;
      const next: CandidateScraperSettings = {
        candidateSources: normalizeSources(s.candidateSources ?? s.candidate_sources ?? []),
        hiringVolume: String(s.hiringVolume ?? s.hiring_volume ?? ""),
      };

      setSettings(next);
      setBaseline(next);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  function toggleSource(source: string, checked: boolean) {
    if (!settings) return;
    const set = new Set(settings.candidateSources ?? []);
    if (checked) set.add(source);
    else set.delete(source);
    setSettings({ ...settings, candidateSources: Array.from(set) });
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/candidate-scraper", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Save failed");
        return;
      }
      await load();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
    return <div className="rounded-xl border bg-white p-5 text-sm text-zinc-600">Loading…</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Candidate Scraper Configuration</CardTitle>
            <div className="mt-1 text-sm text-zinc-600">Choose candidate sources and expected hiring volume.</div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" disabled={!dirty || saving} onClick={load}>
              Cancel
            </Button>
            <Button type="button" disabled={!dirty || saving} onClick={save}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</div> : null}

        <section className="space-y-2">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Candidate sources</div>
            <div className="text-xs text-zinc-600">Select at least one source.</div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CANDIDATE_SOURCES.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  checked={(settings.candidateSources ?? []).includes(s)}
                  onChange={(e) => toggleSource(s, e.target.checked)}
                  className="h-4 w-4"
                />
                <span>{s}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Expected hiring volume</div>
          </div>

          <div className="max-w-sm">
            <Select
              value={settings.hiringVolume}
              onChange={(e) => setSettings({ ...settings, hiringVolume: e.target.value })}
              options={[{ value: "", label: "Select…" }, ...HIRING_VOLUMES.map((v) => ({ value: v, label: v }))] as any}
            />
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
