"use client";

import * as React from "react";
import { Loader2, Play, Settings } from "lucide-react";

import { DashboardShell } from "@/components/shared/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToastViewport, useToast } from "@/components/ui/toast";

type ScraperFilters = {
  counties: string[];
  zipCodes?: string[];
  serviceTypes: string[];
  insuranceProviders: string[];
};

type ScraperConfig = {
  is_enabled: boolean;
  frequency: "hourly" | "daily" | "weekly";
  target_volume: number;
  filters: ScraperFilters;
  keywords: string[];
};

type RunResult = {
  leadsFound: number;
  leadsImported: number;
};

const defaultConfig: ScraperConfig = {
  is_enabled: true,
  frequency: "daily",
  target_volume: 15,
  filters: {
    counties: ["Durham", "Wake", "Cumberland"],
    serviceTypes: ["Mental Health", "Behavioral Health", "Substance Abuse"],
    insuranceProviders: ["Alliance", "AmeriHealth", "Carolina Complete"],
  },
  keywords: ["PTSD", "substance abuse", "counseling", "therapy"],
};

const frequencyOptions: SelectOption[] = [
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export default function ScraperSettingsPage() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isRunning, setIsRunning] = React.useState(false);
  const [config, setConfig] = React.useState<ScraperConfig>(defaultConfig);

  const { items: toasts, push, remove } = useToast();

  const countiesText = React.useMemo(() => config.filters.counties.join(", "), [config.filters.counties]);
  const zipCodesText = React.useMemo(() => (config.filters.zipCodes ?? []).join(", "), [config.filters.zipCodes]);
  const serviceTypesText = React.useMemo(() => config.filters.serviceTypes.join(", "), [config.filters.serviceTypes]);
  const insuranceText = React.useMemo(
    () => config.filters.insuranceProviders.join(", "),
    [config.filters.insuranceProviders]
  );
  const keywordsText = React.useMemo(() => config.keywords.join(", "), [config.keywords]);

  const loadConfig = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/scrapers/nctracks/config");
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; config?: Partial<ScraperConfig> };

      if (!response.ok || !data.ok || !data.config) {
        push({ title: "Failed to load scraper config", description: data.error ?? "Request failed", variant: "danger" });
        return;
      }

      setConfig({
        is_enabled: Boolean(data.config.is_enabled ?? true),
        frequency: (data.config.frequency ?? "daily") as ScraperConfig["frequency"],
        target_volume: Number(data.config.target_volume ?? 15),
        filters: {
          counties: normalizeStringArray(data.config.filters?.counties ?? defaultConfig.filters.counties),
          zipCodes: normalizeStringArray(data.config.filters?.zipCodes ?? []),
          serviceTypes: normalizeStringArray(data.config.filters?.serviceTypes ?? defaultConfig.filters.serviceTypes),
          insuranceProviders: normalizeStringArray(
            data.config.filters?.insuranceProviders ?? defaultConfig.filters.insuranceProviders
          ),
        },
        keywords: normalizeStringArray(data.config.keywords ?? defaultConfig.keywords),
      });
    } catch (error: unknown) {
      push({ title: "Failed to load scraper config", description: error instanceof Error ? error.message : String(error), variant: "danger" });
    } finally {
      setIsLoading(false);
    }
  }, [push]);

  React.useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  async function saveConfig() {
    setIsSaving(true);
    try {
      const response = await fetch("/api/scrapers/nctracks/config", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
      });

      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        push({ title: "Save failed", description: data.error ?? "Request failed", variant: "danger" });
        return;
      }

      push({ title: "Scraper settings saved" });
      await loadConfig();
    } catch (error: unknown) {
      push({ title: "Save failed", description: error instanceof Error ? error.message : String(error), variant: "danger" });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRunScraper() {
    setIsRunning(true);
    try {
      const response = await fetch("/api/scrapers/nctracks/run", { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        result?: RunResult;
      };

      if (!response.ok || !data.ok || !data.result) {
        push({ title: "Scraper failed", description: data.error ?? "Request failed", variant: "danger" });
        return;
      }

      push({
        title: "Scraper completed",
        description: `Found ${data.result.leadsFound} leads, imported ${data.result.leadsImported}.`,
      });
    } catch (error: unknown) {
      push({ title: "Scraper failed", description: error instanceof Error ? error.message : String(error), variant: "danger" });
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <DashboardShell title="Lead Scraper Settings">
      <ToastViewport items={toasts} remove={remove} />

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Lead Scraper Settings</h1>
          <p className="text-sm text-zinc-600">
            Configure automated lead generation from NCTracks and prepare for credential go-live.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>NCTracks Scraper</CardTitle>
                <CardDescription>
                  Automatically pull qualified leads from North Carolina&apos;s Medicaid provider directory.
                </CardDescription>
              </div>
              <Badge variant={config.is_enabled ? "success" : "secondary"}>
                {config.is_enabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-md border bg-zinc-50 p-4">
              <div>
                <div className="text-sm font-medium text-zinc-900">Enable scraper</div>
                <div className="text-xs text-zinc-600">Turn automatic NCTracks scraping on or off.</div>
              </div>
              <Switch
                checked={config.is_enabled}
                onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, is_enabled: checked }))}
                id="scraper-enabled"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium text-zinc-900">Run frequency</div>
                <Select
                  value={config.frequency}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, frequency: e.target.value as ScraperConfig["frequency"] }))
                  }
                  options={frequencyOptions}
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-zinc-900">Target leads per week</div>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={config.target_volume}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      target_volume: Math.min(100, Math.max(1, Number(e.target.value) || 1)),
                    }))
                  }
                />
                <p className="text-xs text-zinc-600">Maximum number of new leads to import per week.</p>
              </div>
            </div>

            <div className="space-y-4 rounded-md border p-4">
              <div className="text-sm font-semibold text-zinc-900">Filter configuration</div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-zinc-900">Counties (comma-separated)</div>
                <Input
                  value={countiesText}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      filters: { ...prev.filters, counties: parseList(e.target.value) },
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-zinc-900">ZIP Codes (optional, comma-separated)</div>
                <Input
                  value={zipCodesText}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      filters: { ...prev.filters, zipCodes: parseList(e.target.value) },
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-zinc-900">Service types (comma-separated)</div>
                <Input
                  value={serviceTypesText}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      filters: { ...prev.filters, serviceTypes: parseList(e.target.value) },
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-zinc-900">Insurance providers (comma-separated)</div>
                <Input
                  value={insuranceText}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      filters: { ...prev.filters, insuranceProviders: parseList(e.target.value) },
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-zinc-900">Keywords (comma-separated)</div>
                <Input
                  value={keywordsText}
                  onChange={(e) => setConfig((prev) => ({ ...prev, keywords: parseList(e.target.value) }))}
                />
              </div>
            </div>

            <div className="rounded-lg border bg-zinc-50 p-4">
              <h4 className="mb-1 text-sm font-medium text-zinc-900">Status</h4>
              <p className="text-sm text-zinc-600">Awaiting NCTracks credentials from CCSS.</p>
              <p className="mt-1 text-sm text-zinc-600">
                Once credentials are provided, this architecture is ready for live scraping.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={saveConfig} disabled={isSaving || isLoading}>
                {isSaving || isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Configuration"
                )}
              </Button>

              <Button type="button" onClick={handleRunScraper} disabled={isRunning || !config.is_enabled}>
                {isRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running Scraper...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Now (Test)
                  </>
                )}
              </Button>

              <Button type="button" variant="outline" onClick={loadConfig} disabled={isLoading}>
                <Settings className="mr-2 h-4 w-4" />
                Reload
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="opacity-60">
          <CardHeader>
            <CardTitle>Durham County Court Records</CardTitle>
            <CardDescription>Coming in Phase 3</CardDescription>
          </CardHeader>
        </Card>

        <Card className="opacity-60">
          <CardHeader>
            <CardTitle>Alliance Health Provider Network</CardTitle>
            <CardDescription>Coming in Phase 3</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </DashboardShell>
  );
}
