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
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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

type EditorDraft = {
  id: string;
  name: string;
  description: string;
  volumeGoal: "low" | "medium" | "high" | "very_high" | "";
  assignmentMethod: "manual" | "round_robin" | "geographic" | "specialization" | "";
  emailHighPriority: boolean;
  dailyDigest: boolean;
  weeklyReport: boolean;
  leadSourcesText: string;
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

function toLeadSourcesText(input: any): string {
  const ls = normalizeLeadSources(input);
  return ls.map((x) => `${x.source}${x.priority ? `,${x.priority}` : ""}`).join("\n");
}

function parseLeadSourcesText(text: string): LeadSourcePref[] {
  const lines = String(text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return lines
    .map((line): LeadSourcePref => {
      const parts = line.split(",").map((p) => p.trim());
      const source = parts[0] ?? "";
      const pr = parts[1] ?? "";
      const priority: LeadSourcePref["priority"] = pr === "high" || pr === "medium" || pr === "low" ? pr : null;
      return { source, priority };
    })
    .filter((x) => x.source);
}

function templateToDraft(t: Template): EditorDraft {
  const config = (t.configuration ?? {}) as TemplateConfig;

  return {
    id: t.id,
    name: String(t.name ?? ""),
    description: String(t.description ?? ""),
    volumeGoal:
      config.volumeGoal === "low" || config.volumeGoal === "medium" || config.volumeGoal === "high" || config.volumeGoal === "very_high"
        ? config.volumeGoal
        : "",
    assignmentMethod:
      config.assignmentMethod === "manual" ||
      config.assignmentMethod === "round_robin" ||
      config.assignmentMethod === "geographic" ||
      config.assignmentMethod === "specialization"
        ? config.assignmentMethod
        : "",
    emailHighPriority: Boolean(config.emailHighPriority),
    dailyDigest: Boolean(config.dailyDigest),
    weeklyReport: Boolean(config.weeklyReport),
    leadSourcesText: toLeadSourcesText(config.leadSources),
  };
}

export function LeadProfileTemplatesCard() {
  const [loading, setLoading] = React.useState(false);
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const [tab, setTab] = React.useState<"system" | "custom">("system");

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editorSaving, setEditorSaving] = React.useState(false);
  const [editorDeleting, setEditorDeleting] = React.useState(false);
  const [draft, setDraft] = React.useState<EditorDraft | null>(null);

  const { items: toasts, push, remove } = useToast();

  const load = React.useCallback(async (): Promise<Template[]> => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/lead-profile-templates");
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || !json?.ok) {
        push({ title: "Failed to load templates", description: json?.error ?? "Request failed", variant: "danger" });
        setTemplates([]);
        return [];
      }
      const next = Array.isArray(json.templates) ? (json.templates as Template[]) : [];
      setTemplates(next);
      return next;
    } catch (e: any) {
      push({ title: "Failed to load templates", description: e?.message ?? "Unknown error", variant: "danger" });
      setTemplates([]);
      return [];
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

  function openEditorForTemplate(t: Template) {
    setDraft(templateToDraft(t));
    setEditorOpen(true);
  }

  async function saveDraft() {
    if (!draft) return;
    setEditorSaving(true);
    try {
      const configuration: TemplateConfig = {
        leadSources: parseLeadSourcesText(draft.leadSourcesText),
        volumeGoal: (draft.volumeGoal || undefined) as any,
        assignmentMethod: (draft.assignmentMethod || undefined) as any,
        emailHighPriority: draft.emailHighPriority,
        dailyDigest: draft.dailyDigest,
        weeklyReport: draft.weeklyReport,
      };

      const res = await fetch(`/api/settings/lead-profile-templates/${draft.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          description: draft.description,
          configuration,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || !json?.ok) {
        push({ title: "Save failed", description: json?.error ?? "Request failed", variant: "danger" });
        return;
      }

      push({ title: "Template saved" });
      await load();
      setEditorOpen(false);
    } catch (e: any) {
      push({ title: "Save failed", description: e?.message ?? "Unknown error", variant: "danger" });
    } finally {
      setEditorSaving(false);
    }
  }

  async function deleteDraft() {
    if (!draft) return;
    setEditorDeleting(true);
    try {
      const res = await fetch(`/api/settings/lead-profile-templates/${draft.id}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || !json?.ok) {
        push({ title: "Delete failed", description: json?.error ?? "Request failed", variant: "danger" });
        return;
      }

      push({ title: "Template deleted" });
      await load();
      setEditorOpen(false);
    } catch (e: any) {
      push({ title: "Delete failed", description: e?.message ?? "Unknown error", variant: "danger" });
    } finally {
      setEditorDeleting(false);
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
      const createdId = String(json?.id ?? "").trim();
      const nextTemplates = await load();
      const created = nextTemplates.find((t) => t.id === createdId) ?? null;
      setTab("custom");
      if (created) {
        openEditorForTemplate(created);
      } else {
        push({ title: "Custom template created", description: "Switch to your custom templates to edit." });
      }
    } catch (e: any) {
      push({ title: "Customize failed", description: e?.message ?? "Unknown error", variant: "danger" });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <div className="rounded-xl border bg-white p-5 text-sm text-zinc-600">Loading…</div>;
  }

  const systemTemplates = templates.filter((t) => t.isSystemDefault);
  const customTemplates = templates.filter((t) => !t.isSystemDefault);

  return (
    <>
      <ToastViewport items={toasts} remove={remove} />

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit custom template</DialogTitle>
            <DialogDescription>Update your template settings, then save.</DialogDescription>
          </DialogHeader>

          {draft ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Name</div>
                  <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Description</div>
                  <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Volume goal</div>
                  <select
                    className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm"
                    value={draft.volumeGoal}
                    onChange={(e) => setDraft({ ...draft, volumeGoal: e.target.value as any })}
                  >
                    <option value="">—</option>
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                    <option value="very_high">very_high</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-medium">Assignment method</div>
                  <select
                    className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm"
                    value={draft.assignmentMethod}
                    onChange={(e) => setDraft({ ...draft, assignmentMethod: e.target.value as any })}
                  >
                    <option value="">—</option>
                    <option value="manual">manual</option>
                    <option value="round_robin">round_robin</option>
                    <option value="geographic">geographic</option>
                    <option value="specialization">specialization</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Lead sources</div>
                <Textarea
                  value={draft.leadSourcesText}
                  onChange={(e) => setDraft({ ...draft, leadSourcesText: e.target.value })}
                  placeholder="One per line. Format: Source Name,priority (priority optional: high|medium|low)"
                  className="min-h-[140px]"
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Notifications</div>
                <div className="grid gap-2 md:grid-cols-3 text-sm">
                  <label className="flex items-center gap-2 rounded-md border bg-zinc-50 p-2">
                    <input
                      type="checkbox"
                      checked={draft.emailHighPriority}
                      onChange={(e) => setDraft({ ...draft, emailHighPriority: e.target.checked })}
                    />
                    High priority
                  </label>
                  <label className="flex items-center gap-2 rounded-md border bg-zinc-50 p-2">
                    <input type="checkbox" checked={draft.dailyDigest} onChange={(e) => setDraft({ ...draft, dailyDigest: e.target.checked })} />
                    Daily digest
                  </label>
                  <label className="flex items-center gap-2 rounded-md border bg-zinc-50 p-2">
                    <input type="checkbox" checked={draft.weeklyReport} onChange={(e) => setDraft({ ...draft, weeklyReport: e.target.checked })} />
                    Weekly report
                  </label>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <div className="flex w-full items-center justify-between gap-3">
              <Button type="button" variant="outline" disabled={!draft || editorDeleting || editorSaving} onClick={deleteDraft}>
                {editorDeleting ? "Deleting…" : "Delete"}
              </Button>
              <div className="flex items-center gap-2">
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={editorDeleting || editorSaving}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="button" disabled={!draft || editorDeleting || editorSaving} onClick={saveDraft}>
                  {editorSaving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="mb-4">
              <TabsTrigger value="system">System templates</TabsTrigger>
              <TabsTrigger value="custom">My templates</TabsTrigger>
            </TabsList>

            <TabsContent value="system">
              {systemTemplates.length ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {systemTemplates.map((t) => {
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
                            <Badge variant="secondary">System</Badge>
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

                            <Button type="button" size="sm" variant="secondary" disabled={isBusy} onClick={() => duplicateTemplate(t.id)}>
                              {isBusy ? "Working…" : "Customize"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border bg-white p-6 text-sm text-zinc-600">No system templates found.</div>
              )}
            </TabsContent>

            <TabsContent value="custom">
              {customTemplates.length ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {customTemplates.map((t) => {
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
                            <Badge variant="success">Custom</Badge>
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

                            <Button type="button" size="sm" variant="secondary" disabled={isBusy} onClick={() => openEditorForTemplate(t)}>
                              Edit
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border bg-white p-6 text-sm text-zinc-600">No custom templates yet. Customize a system template to create one.</div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  );
}
