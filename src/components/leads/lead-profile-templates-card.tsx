"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ToastViewport, useToast } from "@/components/ui/toast";

type LeadSourcePref = { source: string; priority: "high" | "medium" | "low" | null };

type TemplateConfig = {
  leadSources?: LeadSourcePref[];
  volumeGoal?: "low" | "medium" | "high" | "very_high";
  assignmentMethod?: "manual" | "round_robin" | "geographic" | "specialization";
  emailHighPriority?: boolean;
  dailyDigest?: boolean;
  weeklyReport?: boolean;
  highlights?: Record<string, any>;
};

type Template = {
  id: string;
  organizationId: string | null;
  name: string;
  description: string | null;
  isSystemDefault: boolean;
  configuration: TemplateConfig;
  tags: string[];
  usageCount: number;
};

function normalizeLeadSources(input: any): LeadSourcePref[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((x) => ({ source: String(x?.source ?? "").trim(), priority: x?.priority }))
    .filter((x) => x.source)
    .map((x) => ({
      source: x.source,
      priority: x.priority === "high" || x.priority === "medium" || x.priority === "low" ? x.priority : null,
    }));
}

function yesNo(v: any) {
  return v === true ? "Yes" : v === false ? "No" : "—";
}

export function LeadProfileTemplatesCard() {
  const [loading, setLoading] = React.useState(false);
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const { items: toasts, push, remove } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/lead-profile-templates");
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || !json?.ok) {
        push({ title: "Failed to load templates", description: json?.error ?? "Request failed", variant: "danger" });
        setTemplates([]);
        return;
      }
      setTemplates(Array.isArray(json.templates) ? json.templates : []);
    } catch (e: any) {
      push({ title: "Failed to load templates", description: e?.message ?? "Unknown error", variant: "danger" });
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [push]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function applyTemplate(id: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/settings/lead-profile-templates/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ templateId: id }),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || !json?.ok) {
        push({ title: "Apply failed", description: json?.error ?? "Request failed", variant: "danger" });
        return;
      }
      push({ title: "Template applied", description: "Lead scraper settings updated." });
      await load();
    } catch (e: any) {
      push({ title: "Apply failed", description: e?.message ?? "Unknown error", variant: "danger" });
    } finally {
      setBusyId(null);
    }
  }

  async function duplicateTemplate(id: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/settings/lead-profile-templates/duplicate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ templateId: id }),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || !json?.ok) {
        push({ title: "Customize failed", description: json?.error ?? "Request failed", variant: "danger" });
        return;
      }
      push({ title: "Custom template created", description: "You can edit it next (UI coming)." });
      await load();
    } catch (e: any) {
      push({ title: "Customize failed", description: e?.message ?? "Unknown error", variant: "danger" });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <div className="rounded-xl border bg-white p-5 text-sm text-zinc-600">Loading…</div>;
  }

  return (
    <>
      <ToastViewport items={toasts} remove={remove} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Lead Profile Templates</CardTitle>
              <div className="mt-1 text-sm text-zinc-600">Pick a pre-built profile and apply it in one click.</div>
            </div>
            <Button type="button" variant="outline" onClick={load}>
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {templates.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => {
                const config = (t.configuration ?? {}) as TemplateConfig;
                const leadSources = normalizeLeadSources(config.leadSources);
                const isBusy = busyId === t.id;

                return (
                  <Card key={t.id} className="border bg-white">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-zinc-900">{t.name}</div>
                          {t.description ? <div className="mt-1 text-xs text-zinc-600">{t.description}</div> : null}
                        </div>
                        {t.isSystemDefault ? <Badge variant="secondary">System</Badge> : <Badge variant="success">Custom</Badge>}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      <div className="space-y-1 text-xs text-zinc-700">
                        <div>
                          <span className="font-medium">Volume:</span> {String(config.volumeGoal ?? "—")}
                        </div>
                        <div>
                          <span className="font-medium">Assignment:</span> {String(config.assignmentMethod ?? "—")}
                        </div>
                        <div>
                          <span className="font-medium">Sources:</span> {leadSources.length}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button type="button" variant="outline" size="sm">
                              Preview
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{t.name}</DialogTitle>
                              <DialogDescription>{t.description ?? ""}</DialogDescription>
                            </DialogHeader>

                            <div className="space-y-3 text-sm">
                              <div className="grid gap-2 md:grid-cols-2">
                                <div className="rounded-md border bg-zinc-50 p-3">
                                  <div className="text-xs font-semibold text-zinc-900">Volume goal</div>
                                  <div className="mt-1 text-sm text-zinc-700">{String(config.volumeGoal ?? "—")}</div>
                                </div>
                                <div className="rounded-md border bg-zinc-50 p-3">
                                  <div className="text-xs font-semibold text-zinc-900">Assignment</div>
                                  <div className="mt-1 text-sm text-zinc-700">{String(config.assignmentMethod ?? "—")}</div>
                                </div>
                              </div>

                              <div className="rounded-md border bg-white p-3">
                                <div className="text-xs font-semibold text-zinc-900">Lead sources</div>
                                <div className="mt-2 space-y-1">
                                  {leadSources.length ? (
                                    leadSources.slice(0, 12).map((ls) => (
                                      <div key={ls.source} className="flex items-center justify-between gap-3 text-sm">
                                        <div className="text-zinc-900">{ls.source}</div>
                                        <Badge variant="secondary">{ls.priority ?? "—"}</Badge>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-sm text-zinc-600">No sources.</div>
                                  )}
                                </div>
                              </div>

                              <div className="rounded-md border bg-white p-3">
                                <div className="text-xs font-semibold text-zinc-900">Notifications</div>
                                <div className="mt-2 grid gap-2 md:grid-cols-3 text-xs">
                                  <div className="rounded-md border bg-zinc-50 p-2">High priority: {yesNo(config.emailHighPriority)}</div>
                                  <div className="rounded-md border bg-zinc-50 p-2">Daily digest: {yesNo(config.dailyDigest)}</div>
                                  <div className="rounded-md border bg-zinc-50 p-2">Weekly report: {yesNo(config.weeklyReport)}</div>
                                </div>
                              </div>
                            </div>

                            <DialogFooter>
                              <DialogClose asChild>
                                <Button type="button" variant="outline">
                                  Close
                                </Button>
                              </DialogClose>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        <Button type="button" size="sm" disabled={isBusy} onClick={() => applyTemplate(t.id)}>
                          {isBusy ? "Applying…" : "Apply"}
                        </Button>

                        {t.isSystemDefault ? (
                          <Button type="button" size="sm" variant="secondary" disabled={isBusy} onClick={() => duplicateTemplate(t.id)}>
                            {isBusy ? "Working…" : "Customize"}
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border bg-white p-6 text-sm text-zinc-600">No templates found.</div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
