"use client";

import * as React from "react";

import { DashboardShell } from "@/components/shared/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Settings = {
  notify_high_priority_leads: boolean;
  notify_lead_assignments: boolean;
  notify_status_updates: boolean;
  notify_reminders: boolean;
  notify_daily_summary: boolean;
  frequency: "realtime" | "hourly" | "daily";
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  daily_digest_time: string | null;
};

export default function NotificationSettingsPage() {
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function load() {
    const res = await fetch("/api/settings/notifications");
    const json = await res.json().catch(() => ({}));
    if (json.ok) {
      setSettings(json.settings as Settings);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  function toggle<K extends keyof Settings>(k: K) {
    if (!settings) return;
    if (typeof settings[k] === "boolean") {
      setSettings({ ...settings, [k]: !(settings[k] as any) } as any);
    }
  }

  if (!settings) {
    return (
      <DashboardShell title="Notification Settings">
        <div className="rounded-xl border bg-white p-5 text-sm text-zinc-600">Loading…</div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Notification Settings">
      <Card>
        <CardHeader>
          <CardTitle>Email & Dashboard Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="text-sm font-medium text-zinc-900">Email notifications</div>
            <label className="flex items-center justify-between gap-4 rounded-md border bg-white p-3 text-sm">
              <span>High-priority leads</span>
              <input
                type="checkbox"
                checked={settings.notify_high_priority_leads}
                onChange={() => toggle("notify_high_priority_leads")}
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-md border bg-white p-3 text-sm">
              <span>Lead assignments</span>
              <input
                type="checkbox"
                checked={settings.notify_lead_assignments}
                onChange={() => toggle("notify_lead_assignments")}
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-md border bg-white p-3 text-sm">
              <span>Status updates (on my leads)</span>
              <input
                type="checkbox"
                checked={settings.notify_status_updates}
                onChange={() => toggle("notify_status_updates")}
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-md border bg-white p-3 text-sm">
              <span>Reminders</span>
              <input
                type="checkbox"
                checked={settings.notify_reminders}
                onChange={() => toggle("notify_reminders")}
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-md border bg-white p-3 text-sm">
              <span>Daily summary</span>
              <input
                type="checkbox"
                checked={settings.notify_daily_summary}
                onChange={() => toggle("notify_daily_summary")}
              />
            </label>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-zinc-900">Frequency</div>
            <div className="grid gap-2 md:grid-cols-3">
              <label className="flex items-center gap-2 rounded-md border bg-white p-3 text-sm">
                <input
                  type="radio"
                  name="frequency"
                  checked={settings.frequency === "realtime"}
                  onChange={() => setSettings({ ...settings, frequency: "realtime" })}
                />
                Real-time
              </label>
              <label className="flex items-center gap-2 rounded-md border bg-white p-3 text-sm">
                <input
                  type="radio"
                  name="frequency"
                  checked={settings.frequency === "hourly"}
                  onChange={() => setSettings({ ...settings, frequency: "hourly" })}
                />
                Hourly digest
              </label>
              <label className="flex items-center gap-2 rounded-md border bg-white p-3 text-sm">
                <input
                  type="radio"
                  name="frequency"
                  checked={settings.frequency === "daily"}
                  onChange={() => setSettings({ ...settings, frequency: "daily" })}
                />
                Daily digest
              </label>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="text-sm font-medium text-zinc-900">Quiet hours start</div>
              <Input
                type="time"
                value={settings.quiet_hours_start ?? ""}
                onChange={(e) => setSettings({ ...settings, quiet_hours_start: e.target.value || null })}
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-zinc-900">Quiet hours end</div>
              <Input
                type="time"
                value={settings.quiet_hours_end ?? ""}
                onChange={(e) => setSettings({ ...settings, quiet_hours_end: e.target.value || null })}
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-zinc-900">Daily digest time</div>
              <Input
                type="time"
                value={settings.daily_digest_time ?? "08:00"}
                onChange={(e) => setSettings({ ...settings, daily_digest_time: e.target.value || null })}
              />
            </div>
          </div>

          <div>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
