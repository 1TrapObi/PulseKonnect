"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import type { z } from "zod";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import { step5Schema, type Step5FormData } from "@/lib/validation/onboarding-schemas";

const STORAGE_KEY = "pk_onboarding_admin_step5";

const ROLE_OPTIONS = [
  { value: "staff", label: "Staff" },
  { value: "admin", label: "Admin" },
  { value: "viewer", label: "Viewer" },
] as const;

const DEFAULT_INVITE = { email: "", role: "staff" as const };

export function Step5Form({ initialValues }: { initialValues?: Partial<Step5FormData> }) {
  const router = useRouter();
  const { setCurrentStep, setIntegrationsSetup } = useOnboardingStore();

  type Step5FormValues = z.input<typeof step5Schema>;

  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved">("idle");
  const [apiError, setApiError] = React.useState<string | null>(null);
  const [testingPost, setTestingPost] = React.useState(false);
  const [postTestResult, setPostTestResult] = React.useState<{ ok: boolean; message?: string } | null>(null);
  const [showSuccess, setShowSuccess] = React.useState(false);

  const form = useForm<Step5FormValues>({
    resolver: zodResolver(step5Schema),
    mode: "onChange",
    defaultValues: {
      hasPostAccount: initialValues?.hasPostAccount ?? false,
      postApiKey: initialValues?.postApiKey ?? "",
      emailNotifications: {
        highPriorityLeads: initialValues?.emailNotifications?.highPriorityLeads ?? true,
        newCandidates: initialValues?.emailNotifications?.newCandidates ?? true,
        weeklySummary: initialValues?.emailNotifications?.weeklySummary ?? false,
        systemUpdates: initialValues?.emailNotifications?.systemUpdates ?? false,
      },
      teamInvitations: (initialValues?.teamInvitations as any) ?? [],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: "teamInvitations" });

  React.useEffect(() => {
    setCurrentStep(5);
  }, [setCurrentStep]);

  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const r = step5Schema.partial().safeParse(parsed);
      if (!r.success) return;
      form.reset({
        hasPostAccount: r.data.hasPostAccount ?? form.getValues("hasPostAccount"),
        postApiKey: (r.data.postApiKey as any) ?? form.getValues("postApiKey"),
        emailNotifications: {
          highPriorityLeads:
            r.data.emailNotifications?.highPriorityLeads ?? form.getValues("emailNotifications.highPriorityLeads"),
          newCandidates: r.data.emailNotifications?.newCandidates ?? form.getValues("emailNotifications.newCandidates"),
          weeklySummary: r.data.emailNotifications?.weeklySummary ?? form.getValues("emailNotifications.weeklySummary"),
          systemUpdates: r.data.emailNotifications?.systemUpdates ?? form.getValues("emailNotifications.systemUpdates"),
        },
        teamInvitations: (r.data.teamInvitations as any) ?? form.getValues("teamInvitations"),
      });
    } catch {
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const watched = form.watch();
  React.useEffect(() => {
    setSaveState("saving");
    const t = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(watched));
        setSaveState("saved");
      } catch {
        setSaveState("idle");
      }
    }, 250);

    return () => window.clearTimeout(t);
  }, [watched]);

  const hasPostAccount = form.watch("hasPostAccount");

  async function testPost() {
    setPostTestResult(null);
    setApiError(null);

    const apiKey = String(form.getValues("postApiKey") ?? "").trim();
    if (!apiKey) {
      setPostTestResult({ ok: false, message: "Please enter an API key" });
      return;
    }

    setTestingPost(true);
    try {
      const res = await fetch("/api/integrations/post/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.connected) {
        setPostTestResult({ ok: false, message: json.error ?? "Connection failed" });
      } else {
        setPostTestResult({ ok: true, message: "Connected" });
      }
    } catch (e: any) {
      setPostTestResult({ ok: false, message: e?.message ?? "Connection failed" });
    } finally {
      setTestingPost(false);
    }
  }

  const saving = form.formState.isSubmitting;
  const canComplete = form.formState.isValid && !saving;

  async function submit() {
    setApiError(null);

    const parsed = step5Schema.safeParse(form.getValues());
    if (!parsed.success) {
      parsed.error.issues.forEach((i) => {
        const field = String(i.path?.[0] ?? "");
        if (field) form.setError(field as any, { message: i.message });
      });
      return;
    }

    try {
      const res = await fetch("/api/onboarding/admin/step-5", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setApiError(json.error ?? "Finalization failed");
        return;
      }

      setIntegrationsSetup({
        hasPostAccount: parsed.data.hasPostAccount,
        postApiKey: parsed.data.postApiKey,
        postConnected: Boolean(json.postConnected ?? false),
        emailNotifications: parsed.data.emailNotifications,
        teamInvitations: parsed.data.teamInvitations ?? [],
      } as any);

      try {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // noop
      }

      setShowSuccess(true);
      window.setTimeout(() => {
        router.push("/dashboard");
      }, 3000);
    } catch (e: any) {
      setApiError(e?.message ?? "Finalization failed");
    }
  }

  function addInvite() {
    append(DEFAULT_INVITE as any);
  }

  function clearInvites() {
    replace([]);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Almost done! 🎉</CardTitle>
              <div className="mt-1 text-sm text-zinc-600">Let&apos;s connect your tools and invite your team.</div>
            </div>
            <div className="text-xs text-zinc-500">
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {apiError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{apiError}</div>
          ) : null}

          <section className="space-y-3">
            <div>
              <div className="text-sm font-medium">Post Integration (Optional)</div>
              <div className="text-xs text-zinc-600">Connect your Post account for client management</div>
            </div>

            <label className="flex items-center gap-2 text-sm text-zinc-800">
              <input
                type="checkbox"
                checked={hasPostAccount}
                onChange={(e) => {
                  setPostTestResult(null);
                  form.setValue("hasPostAccount", e.target.checked, { shouldValidate: true });
                }}
                className="h-4 w-4"
              />
              <span>I have a Post account</span>
            </label>

            {hasPostAccount ? (
              <div className="block rounded-2xl border bg-white p-4 shadow-sm">
                <div className="text-sm font-medium text-zinc-900">Connect to Post</div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
                  <div className="sm:col-span-2">
                    <div className="text-xs text-zinc-600">API Key</div>
                    <Input
                      value={form.watch("postApiKey") ?? ""}
                      onChange={(e) => {
                        setPostTestResult(null);
                        form.setValue("postApiKey", e.target.value, { shouldValidate: true });
                      }}
                      placeholder="Enter Post API key"
                    />
                    {form.formState.errors.postApiKey ? (
                      <div className="mt-1 text-xs text-red-600">{form.formState.errors.postApiKey.message as any}</div>
                    ) : null}
                  </div>

                  <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" onClick={testPost} disabled={testingPost}>
                      {testingPost ? "Testing…" : "Test Connection"}
                    </Button>
                    {postTestResult ? (
                      <div className={`text-sm ${postTestResult.ok ? "text-emerald-700" : "text-red-700"}`}>
                        {postTestResult.message}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <div>
              <div className="text-sm font-medium">Email Notification Settings</div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  checked={form.watch("emailNotifications.highPriorityLeads")}
                  onChange={(e) =>
                    form.setValue("emailNotifications.highPriorityLeads", e.target.checked, { shouldValidate: true })
                  }
                  className="h-4 w-4"
                />
                <span>High-priority leads</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  checked={form.watch("emailNotifications.newCandidates")}
                  onChange={(e) =>
                    form.setValue("emailNotifications.newCandidates", e.target.checked, { shouldValidate: true })
                  }
                  className="h-4 w-4"
                />
                <span>New candidate applications</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  checked={form.watch("emailNotifications.weeklySummary")}
                  onChange={(e) =>
                    form.setValue("emailNotifications.weeklySummary", e.target.checked, { shouldValidate: true })
                  }
                  className="h-4 w-4"
                />
                <span>Weekly performance summary</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  checked={form.watch("emailNotifications.systemUpdates")}
                  onChange={(e) =>
                    form.setValue("emailNotifications.systemUpdates", e.target.checked, { shouldValidate: true })
                  }
                  className="h-4 w-4"
                />
                <span>System updates and announcements</span>
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Invite Your Team (Optional)</div>
                <div className="text-xs text-zinc-600">We&apos;ll send them an invitation email to join.</div>
              </div>
              <button type="button" onClick={clearInvites} className="text-xs text-zinc-500 hover:text-zinc-900">
                I&apos;ll invite my team later
              </button>
            </div>

            {fields.length ? (
              <div className="space-y-2">
                {fields.map((f, idx) => (
                  <div key={f.id} className="grid grid-cols-1 gap-2 rounded-xl border bg-white p-3 sm:grid-cols-12 sm:items-center">
                    <div className="sm:col-span-7">
                      <div className="text-xs text-zinc-600">Email Address</div>
                      <Input
                        value={String(form.getValues(`teamInvitations.${idx}.email`) ?? "")}
                        onChange={(e) => form.setValue(`teamInvitations.${idx}.email` as any, e.target.value, { shouldValidate: true })}
                        placeholder="name@example.com"
                      />
                      {(form.formState.errors.teamInvitations as any)?.[idx]?.email ? (
                        <div className="mt-1 text-xs text-red-600">
                          {(form.formState.errors.teamInvitations as any)[idx].email.message}
                        </div>
                      ) : null}
                    </div>

                    <div className="sm:col-span-4">
                      <div className="text-xs text-zinc-600">Role</div>
                      <Select
                        value={String(form.getValues(`teamInvitations.${idx}.role`) ?? "staff")}
                        onChange={(e) => form.setValue(`teamInvitations.${idx}.role` as any, e.target.value as any, { shouldValidate: true })}
                        options={ROLE_OPTIONS as any}
                      />
                    </div>

                    <div className="sm:col-span-1 sm:flex sm:justify-end">
                      <Button type="button" variant="ghost" onClick={() => remove(idx)}>
                        ×
                      </Button>
                    </div>
                  </div>
                ))}

                {(form.formState.errors.teamInvitations as any)?.message ? (
                  <div className="text-xs text-red-600">{(form.formState.errors.teamInvitations as any).message}</div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border bg-zinc-50 p-3 text-sm text-zinc-700">
                No invitations added.
              </div>
            )}

            <Button type="button" variant="outline" onClick={addInvite}>
              + Add Another Team Member
            </Button>
          </section>

          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={() => router.push("/onboarding/admin/step-4")} disabled={saving}>
              Back
            </Button>
            <Button type="button" onClick={form.handleSubmit(submit)} disabled={!canComplete}>
              {saving ? "Finalizing your setup…" : "Complete Setup 🎉"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showSuccess}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>✅ Setup Complete!</DialogTitle>
            <DialogDescription>Your PulseKonnect account is ready to use.</DialogDescription>
          </DialogHeader>
          <div className="text-sm text-zinc-600">Redirecting to your dashboard in 3 seconds…</div>
          <DialogFooter>
            <Button type="button" onClick={() => router.push("/dashboard")}>Go to Dashboard Now →</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
