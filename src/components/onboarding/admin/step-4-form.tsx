"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { OnboardingButtons } from "@/components/onboarding/admin/onboarding-buttons";
import { PositionCard } from "@/components/onboarding/admin/position-card";
import {
  CANDIDATE_SOURCES,
  HIRING_VOLUMES,
} from "@/lib/constants/onboarding";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import { step4Schema, type Step4FormData } from "@/lib/validation/onboarding-schemas";

const STORAGE_KEY = "pk_onboarding_admin_step4";

const DEFAULT_POSITION = {
  title: "",
  requiredLicenses: [],
  experienceLevel: "mid" as const,
  employmentType: "full_time" as const,
  specializations: [],
  salaryMin: undefined,
  salaryMax: undefined,
};

type Step4FormInput = z.input<typeof step4Schema>;

export function Step4Form({ initialValues }: { initialValues?: Partial<Step4FormInput> }) {
  const router = useRouter();
  const { setCurrentStep, setRecruitmentPreferences } = useOnboardingStore();

  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved">("idle");
  const [apiError, setApiError] = React.useState<string | null>(null);

  const form = useForm<Step4FormInput>({
    resolver: zodResolver(step4Schema),
    mode: "onChange",
    defaultValues: {
      skipPositions: initialValues?.skipPositions ?? false,
      positions: (initialValues?.positions as any) ?? [],
      candidateSources: initialValues?.candidateSources ?? [],
      hiringVolume: initialValues?.hiringVolume ?? "",
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: "positions" });

  React.useEffect(() => {
    setCurrentStep(4);
  }, [setCurrentStep]);

  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const r = step4Schema.partial().safeParse(parsed);
      if (!r.success) return;
      form.reset({
        skipPositions: r.data.skipPositions ?? form.getValues("skipPositions"),
        positions: (r.data.positions as any) ?? form.getValues("positions"),
        candidateSources: r.data.candidateSources ?? form.getValues("candidateSources"),
        hiringVolume: r.data.hiringVolume ?? form.getValues("hiringVolume"),
      });

      const skip = Boolean(r.data.skipPositions);
      if (!skip && (!r.data.positions || r.data.positions.length === 0)) {
        replace([DEFAULT_POSITION as any]);
      }
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

  const skipPositions = form.watch("skipPositions");

  React.useEffect(() => {
    if (skipPositions) {
      replace([]);
    } else {
      if (fields.length === 0) {
        replace([DEFAULT_POSITION as any]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipPositions]);

  const saving = form.formState.isSubmitting;
  const canContinue = form.formState.isValid && !saving;

  const candidateSources = form.watch("candidateSources") || [];

  function toggleCandidateSource(source: string, checked: boolean) {
    const set = new Set(candidateSources);
    if (checked) set.add(source);
    else set.delete(source);
    form.setValue("candidateSources", Array.from(set), { shouldValidate: true });
  }

  async function submit() {
    setApiError(null);
    const parsed = step4Schema.safeParse(form.getValues());
    if (!parsed.success) {
      parsed.error.issues.forEach((i) => {
        const field = String(i.path?.[0] ?? "");
        if (field) form.setError(field as any, { message: i.message });
      });
      return;
    }

    try {
      const res = await fetch("/api/onboarding/admin/step-4", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setApiError(json.error ?? "Save failed");
        return;
      }

      setRecruitmentPreferences(parsed.data as any);

      try {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // noop
      }

      router.push(json.nextStep ?? "/onboarding/admin/step-5");
    } catch (e: any) {
      setApiError(e?.message ?? "Save failed");
    }
  }

  function addPosition() {
    if (fields.length >= 10) return;
    append(DEFAULT_POSITION as any);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Recruitment Setup 👥</CardTitle>
            <div className="mt-1 text-sm text-zinc-600">Tell us about your hiring needs so we can help you find great candidates.</div>
          </div>
          <div className="text-xs text-zinc-500">{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : null}</div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {apiError ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{apiError}</div>
        ) : null}

        <section className="space-y-3">
          <div>
            <div className="text-sm font-medium">Open Positions (Optional)</div>
            <div className="text-xs text-zinc-600">Can skip this section if not currently hiring</div>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={skipPositions}
              onChange={(e) => form.setValue("skipPositions", e.target.checked, { shouldValidate: true })}
              className="h-4 w-4"
            />
            <span>Skip for now - I&apos;m not hiring right now</span>
          </label>

          {skipPositions ? (
            <div className="rounded-xl border bg-zinc-50 p-3 text-sm text-zinc-700">
              You can add positions later in Settings.
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {fields.map((f, idx) => (
                  <PositionCard
                    key={f.id}
                    index={idx}
                    value={(form.getValues(`positions.${idx}`) as any) ?? DEFAULT_POSITION}
                    onRemove={fields.length > 1 ? () => remove(idx) : undefined}
                    onChange={(next) => form.setValue(`positions.${idx}` as any, next, { shouldValidate: true })}
                    error={(form.formState.errors.positions as any)?.[idx]}
                  />
                ))}
              </div>

              {(form.formState.errors.positions as any)?.message ? (
                <div className="text-xs text-red-600">{(form.formState.errors.positions as any).message}</div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={addPosition}
                  disabled={fields.length >= 10}
                  className="rounded-md border bg-white px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                >
                  + Add Another Position
                </button>
                <div className="text-xs text-zinc-500">Up to 10 positions</div>
              </div>
            </>
          )}
        </section>

        <section className="space-y-2">
          <div>
            <div className="text-sm font-medium">Candidate Sourcing Preferences *</div>
            <div className="text-xs text-zinc-600">Where should we look for candidates?</div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CANDIDATE_SOURCES.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  checked={candidateSources.includes(s)}
                  onChange={(e) => toggleCandidateSource(s, e.target.checked)}
                  className="h-4 w-4"
                />
                <span>{s}</span>
              </label>
            ))}
          </div>

          {form.formState.errors.candidateSources ? (
            <div className="text-xs text-red-600">{form.formState.errors.candidateSources.message as any}</div>
          ) : null}
        </section>

        <section className="space-y-2">
          <div>
            <div className="text-sm font-medium">Expected Hiring Volume *</div>
            <div className="text-xs text-zinc-600">How many people do you plan to hire in the next 6 months?</div>
          </div>

          <div className="max-w-sm">
            <Select
              value={form.watch("hiringVolume")}
              onChange={(e) => form.setValue("hiringVolume", e.target.value, { shouldValidate: true })}
              options={[{ value: "", label: "Select…" }, ...HIRING_VOLUMES.map((v) => ({ value: v, label: v }))]}
            />
          </div>

          {form.formState.errors.hiringVolume ? (
            <div className="text-xs text-red-600">{form.formState.errors.hiringVolume.message as any}</div>
          ) : null}
        </section>

        <OnboardingButtons
          backDisabled={saving}
          continueDisabled={!canContinue}
          loading={saving}
          onBack={() => router.push("/onboarding/admin/step-3")}
          onContinue={form.handleSubmit(submit)}
        />
      </CardContent>
    </Card>
  );
}
