"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { LeadSourceSelector } from "@/components/onboarding/admin/lead-source-selector";
import { ASSIGNMENT_METHODS, LEAD_SOURCES, VOLUME_GOALS } from "@/lib/constants/onboarding";

type LeadSourcePref = {
  source: string;
  priority: "high" | "medium" | "low" | null;
};

type LeadScraperSettings = {
  leadSources: LeadSourcePref[];
  volumeGoal: "low" | "medium" | "high" | "very_high";
  assignmentMethod: "manual" | "round_robin" | "geographic" | "specialization";
};

function uniqueSources(items: any): LeadSourcePref[] {
  const arr = Array.isArray(items) ? items : [];
  const map = new Map<string, LeadSourcePref["priority"]>();
  for (const it of arr) {
    const source = String((it as any)?.source ?? "").trim();
    if (!source) continue;
    const p = (it as any)?.priority;
    const priority = p === "high" || p === "medium" || p === "low" ? p : null;
    map.set(source, priority);
  }
  return Array.from(map.entries()).map(([source, priority]) => ({ source, priority }));
}

export function LeadScraperSettingsCard() {
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [settings, setSettings] = React.useState<LeadScraperSettings | null>(null);
  const [baseline, setBaseline] = React.useState<LeadScraperSettings | null>(null);

  const dirty = React.useMemo(() => {
    if (!settings || !baseline) return false;
    return JSON.stringify(settings) !== JSON.stringify(baseline);
  }, [settings, baseline]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/lead-scraper");
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) return;

      const s = (json.settings ?? {}) as any;
      const next: LeadScraperSettings = {
        leadSources: uniqueSources(s.leadSources ?? s.lead_sources ?? []),
        volumeGoal: (String(s.volumeGoal ?? s.volume_goal ?? "medium") as any) || "medium",
        assignmentMethod: (String(s.assignmentMethod ?? s.assignment_method ?? "manual") as any) || "manual",
      };

      setSettings(next);
      setBaseline(next);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  function getSelectedMap() {
    const m = new Map<string, LeadSourcePref["priority"]>();
    for (const ls of settings?.leadSources ?? []) {
      m.set(ls.source, ls.priority);
    }
    return m;
  }

  function toggleSource(source: string, checked: boolean) {
    if (!settings) return;
    const cur = getSelectedMap();
    if (checked) {
      if (!cur.has(source)) cur.set(source, "medium");
    } else {
      cur.delete(source);
    }
    setSettings({
      ...settings,
      leadSources: Array.from(cur.entries()).map(([s, p]) => ({ source: s, priority: p })),
    });
  }

  function setPriority(source: string, priority: LeadSourcePref["priority"]) {
    if (!settings) return;
    const cur = getSelectedMap();
    if (!cur.has(source)) return;
    cur.set(source, priority);
    setSettings({
      ...settings,
      leadSources: Array.from(cur.entries()).map(([s, p]) => ({ source: s, priority: p })),
    });
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      await fetch("/api/settings/lead-scraper", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      await load();
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
            <CardTitle>Lead Scraper Configuration</CardTitle>
            <div className="mt-1 text-sm text-zinc-600">Manage lead sources, prioritization, and assignment behavior.</div>
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
      <CardContent className="space-y-8">
        <section className="space-y-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Lead sources</div>
            <div className="text-xs text-zinc-600">Select sources to scrape and choose a priority.</div>
          </div>
          <div className="space-y-2">
            {LEAD_SOURCES.map((source) => {
              const selected = (settings.leadSources ?? []).find((x) => x.source === source);
              return (
                <LeadSourceSelector
                  key={source}
                  source={source}
                  checked={Boolean(selected)}
                  priority={(selected?.priority ?? null) as any}
                  onCheckedChange={(checked) => toggleSource(source, checked)}
                  onPriorityChange={(p) => setPriority(source, p)}
                />
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm font-semibold text-zinc-900">Volume goal</div>
            <Select
              value={settings.volumeGoal}
              onChange={(e) => setSettings({ ...settings, volumeGoal: e.target.value as any })}
              options={VOLUME_GOALS as any}
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-zinc-900">Assignment method</div>
            <Select
              value={settings.assignmentMethod}
              onChange={(e) => setSettings({ ...settings, assignmentMethod: e.target.value as any })}
              options={ASSIGNMENT_METHODS.map((m) => ({ value: m.value, label: m.label })) as any}
            />
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
