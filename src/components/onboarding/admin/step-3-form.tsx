"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardingButtons } from "@/components/onboarding/admin/onboarding-buttons";
import { LeadSourceSelector } from "@/components/onboarding/admin/lead-source-selector";
import { step3Schema, type Step3FormData } from "@/lib/validation/onboarding-schemas";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import { ASSIGNMENT_METHODS, LEAD_SOURCES, VOLUME_GOALS } from "@/lib/constants/onboarding";

const STORAGE_KEY = "pk_onboarding_admin_step3";

function uniqueSources(items: { source: string; priority: any }[]) {
  const map = new Map<string, any>();
  for (const it of items || []) {
    if (!it?.source) continue;
    map.set(String(it.source), it.priority ?? null);
  }
  return Array.from(map.entries()).map(([source, priority]) => ({ source, priority }));
}

type Step3FormInput = z.input<typeof step3Schema>;

export function Step3Form({ initialValues }: { initialValues?: Partial<Step3FormInput> }) {
  const router = useRouter();
  const { setCurrentStep, setLeadGenPreferences } = useOnboardingStore();

  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved">("idle");
  const [apiError, setApiError] = React.useState<string | null>(null);

  const form = useForm<Step3FormInput>({
    resolver: zodResolver(step3Schema),
    mode: "onChange",
    defaultValues: {
      leadSources: uniqueSources((initialValues?.leadSources as any) ?? []),
      volumeGoal: (initialValues?.volumeGoal as any) ?? "medium",
      assignmentMethod: (initialValues?.assignmentMethod as any) ?? "manual",
      emailHighPriority: initialValues?.emailHighPriority ?? true,
      dailyDigest: initialValues?.dailyDigest ?? false,
      weeklyReport: initialValues?.weeklyReport ?? true,
    },
  });

  React.useEffect(() => {
    setCurrentStep(3);
  }, [setCurrentStep]);

  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const r = step3Schema.partial().safeParse(parsed);
      if (!r.success) return;
      form.reset({
        leadSources: uniqueSources((r.data.leadSources as any) ?? form.getValues("leadSources")),
        volumeGoal: (r.data.volumeGoal as any) ?? form.getValues("volumeGoal"),
        assignmentMethod: (r.data.assignmentMethod as any) ?? form.getValues("assignmentMethod"),
        emailHighPriority: r.data.emailHighPriority ?? form.getValues("emailHighPriority"),
        dailyDigest: r.data.dailyDigest ?? form.getValues("dailyDigest"),
        weeklyReport: r.data.weeklyReport ?? form.getValues("weeklyReport"),
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

  function getSelectedMap() {
    const m = new Map<string, "high" | "medium" | "low" | null>();
    for (const ls of form.getValues("leadSources") || []) {
      m.set(ls.source, ls.priority);
    }
    return m;
  }

  function toggleSource(source: string, checked: boolean) {
    const cur = getSelectedMap();
    if (checked) {
      if (!cur.has(source)) cur.set(source, "medium");
    } else {
      cur.delete(source);
    }
    form.setValue(
      "leadSources",
      Array.from(cur.entries()).map(([s, p]) => ({ source: s, priority: p })),
      { shouldValidate: true }
    );
  }

  function setPriority(source: string, priority: "high" | "medium" | "low" | null) {
    const cur = getSelectedMap();
    if (!cur.has(source)) return;
    cur.set(source, priority);
    form.setValue(
      "leadSources",
      Array.from(cur.entries()).map(([s, p]) => ({ source: s, priority: p })),
      { shouldValidate: true }
    );
  }

  const saving = form.formState.isSubmitting;
  const canContinue = form.formState.isValid && !saving;

  async function submit() {
    setApiError(null);
    const parsed = step3Schema.safeParse(form.getValues());
    if (!parsed.success) {
      parsed.error.issues.forEach((i) => {
        const field = String(i.path?.[0] ?? "");
        if (field) form.setError(field as any, { message: i.message });
      });
      return;
    }

    try {
      const res = await fetch("/api/onboarding/admin/step-3", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setApiError(json.error ?? "Save failed");
        return;
      }

      setLeadGenPreferences(parsed.data as any);

      try {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // noop
      }

      router.push(json.nextStep ?? "/onboarding/admin/step-4");
    } catch (e: any) {
      setApiError(e?.message ?? "Save failed");
    }
  }

  const selectedMap = React.useMemo(() => {
    const m = new Map<string, any>();
    for (const ls of form.watch("leadSources") || []) m.set(ls.source, ls.priority);
    return m;
  }, [form.watch("leadSources")]);

  const selectedCount = (form.watch("leadSources") || []).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Lead Generation Setup 🎯</CardTitle>
            <div className="mt-1 text-sm text-zinc-600">Configure how we&apos;ll help you find new clients.</div>
          </div>
          <div className="text-xs text-zinc-500">
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {apiError ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{apiError}</div>
        ) : null}

        <section className="space-y-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Lead Sources *</div>
              <div className="text-xs text-zinc-600">Select sources and set priorities</div>
            </div>
            <div className="text-xs text-zinc-500">{selectedCount} selected</div>
          </div>

          <div className="space-y-2">
            {LEAD_SOURCES.map((s) => (
              <LeadSourceSelector
                key={s}
                source={s}
                checked={selectedMap.has(s)}
                priority={(selectedMap.get(s) ?? null) as any}
                onCheckedChange={(checked) => toggleSource(s, checked)}
                onPriorityChange={(p) => setPriority(s, p)}
              />
            ))}
          </div>

          {form.formState.errors.leadSources ? (
            <div className="text-xs text-red-600">{form.formState.errors.leadSources.message as any}</div>
          ) : null}
        </section>

        <section className="space-y-2">
          <div>
            <div className="text-sm font-medium">Lead Volume Goal *</div>
            <div className="text-xs text-zinc-600">Select one</div>
          </div>

          <div className="space-y-2">
            {VOLUME_GOALS.map((g) => (
              <label key={g.value} className="flex items-center gap-2 text-sm text-zinc-800">
                <input
                  type="radio"
                  name="volumeGoal"
                  checked={form.watch("volumeGoal") === g.value}
                  onChange={() => form.setValue("volumeGoal", g.value as any, { shouldValidate: true })}
                />
                <span>{g.label}</span>
              </label>
            ))}
          </div>

          {form.formState.errors.volumeGoal ? (
            <div className="text-xs text-red-600">{form.formState.errors.volumeGoal.message as any}</div>
          ) : null}
        </section>

        <section className="space-y-2">
          <div>
            <div className="text-sm font-medium">Lead Assignment Method *</div>
            <div className="text-xs text-zinc-600">You can change this later in settings.</div>
          </div>

          <div className="space-y-2">
            {ASSIGNMENT_METHODS.map((m) => (
              <label key={m.value} className="flex items-start gap-2 text-sm text-zinc-800">
                <input
                  type="radio"
                  name="assignmentMethod"
                  checked={form.watch("assignmentMethod") === m.value}
                  onChange={() => form.setValue("assignmentMethod", m.value as any, { shouldValidate: true })}
                />
                <span>
                  <div className="font-medium">{m.label}</div>
                  <div className="text-xs text-zinc-600">{m.description}</div>
                </span>
              </label>
            ))}
          </div>

          {form.formState.errors.assignmentMethod ? (
            <div className="text-xs text-red-600">{form.formState.errors.assignmentMethod.message as any}</div>
          ) : null}
        </section>

        <section className="space-y-2">
          <div>
            <div className="text-sm font-medium">Notification Preferences</div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-zinc-800">
              <input
                type="checkbox"
                checked={form.watch("emailHighPriority")}
                onChange={(e) => form.setValue("emailHighPriority", e.target.checked)}
                className="h-4 w-4"
              />
              <span>Email me when high-priority leads arrive</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-800">
              <input
                type="checkbox"
                checked={form.watch("dailyDigest")}
                onChange={(e) => form.setValue("dailyDigest", e.target.checked)}
                className="h-4 w-4"
              />
              <span>Daily digest of new leads (8 AM)</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-800">
              <input
                type="checkbox"
                checked={form.watch("weeklyReport")}
                onChange={(e) => form.setValue("weeklyReport", e.target.checked)}
                className="h-4 w-4"
              />
              <span>Weekly lead performance report (Mondays)</span>
            </label>
          </div>
        </section>

        <OnboardingButtons
          backDisabled={saving}
          continueDisabled={!canContinue}
          loading={saving}
          onBack={() => router.push("/onboarding/admin/step-2")}
          onContinue={form.handleSubmit(submit)}
        />
      </CardContent>
    </Card>
  );
}
