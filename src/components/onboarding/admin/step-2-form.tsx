"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OnboardingButtons } from "@/components/onboarding/admin/onboarding-buttons";
import { CheckboxGroup } from "@/components/onboarding/admin/checkbox-group";
import { step2Schema, type Step2FormData } from "@/lib/validation/onboarding-schemas";
import { useOnboardingStore } from "@/lib/store/onboarding-store";

const STORAGE_KEY = "pk_onboarding_admin_step2";

const serviceTypeOptions = [
  "Substance Abuse Treatment",
  "Mental Health Counseling",
  "Peer Support Services",
  "Intensive In-Home Services",
  "Crisis Intervention",
  "Family Therapy",
  "Case Management",
  "Medication Management",
  "Group Therapy",
  "Other",
];

const ageGroupOptions = [
  "Children (0-12)",
  "Adolescents (13-17)",
  "Young Adults (18-25)",
  "Adults (26-64)",
  "Seniors (65+)",
];

const insuranceOptions = [
  "Medicaid",
  "Medicare",
  "Private Insurance (Commercial)",
  "Blue Cross Blue Shield",
  "Aetna",
  "UnitedHealthcare",
  "Cigna",
  "Self-Pay / Out of Pocket",
  "Sliding Scale Fees",
  "Other",
];

export function Step2Form({ initialValues }: { initialValues?: Partial<Step2FormData> }) {
  const router = useRouter();
  const { setCurrentStep, setServicesProfile } = useOnboardingStore();

  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved">("idle");
  const [apiError, setApiError] = React.useState<string | null>(null);

  const form = useForm<Step2FormData>({
    resolver: zodResolver(step2Schema),
    mode: "onChange",
    defaultValues: {
      serviceTypes: initialValues?.serviceTypes ?? [],
      otherServiceType: initialValues?.otherServiceType ?? "",
      ageGroups: initialValues?.ageGroups ?? [],
      insuranceTypes: initialValues?.insuranceTypes ?? [],
      otherInsuranceType: initialValues?.otherInsuranceType ?? "",
    },
  });

  React.useEffect(() => {
    setCurrentStep(2);
  }, [setCurrentStep]);

  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const r = step2Schema.partial().safeParse(parsed);
      if (!r.success) return;
      form.reset({
        serviceTypes: r.data.serviceTypes ?? form.getValues("serviceTypes"),
        otherServiceType: r.data.otherServiceType ?? form.getValues("otherServiceType"),
        ageGroups: r.data.ageGroups ?? form.getValues("ageGroups"),
        insuranceTypes: r.data.insuranceTypes ?? form.getValues("insuranceTypes"),
        otherInsuranceType: r.data.otherInsuranceType ?? form.getValues("otherInsuranceType"),
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

  const saving = form.formState.isSubmitting;
  const canContinue = form.formState.isValid && !saving;

  async function submit() {
    setApiError(null);

    const parsed = step2Schema.safeParse(form.getValues());
    if (!parsed.success) {
      parsed.error.issues.forEach((i) => {
        const field = String(i.path?.[0] ?? "");
        if (field) form.setError(field as any, { message: i.message });
      });
      return;
    }

    try {
      const res = await fetch("/api/onboarding/admin/step-2", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setApiError(json.error ?? "Save failed");
        return;
      }

      setServicesProfile(parsed.data);

      try {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // noop
      }

      router.push(json.nextStep ?? "/onboarding/admin/step-3");
    } catch (e: any) {
      setApiError(e?.message ?? "Save failed");
    }
  }

  const serviceTypes = form.watch("serviceTypes");
  const insuranceTypes = form.watch("insuranceTypes");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Tell us about your services 🏥</CardTitle>
            <div className="mt-1 text-sm text-zinc-600">
              This helps us match you with the right clients and candidates.
            </div>
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
              <div className="text-sm font-medium">Service Types *</div>
              <div className="text-xs text-zinc-600">Select all that apply</div>
            </div>
            <div className="text-xs text-zinc-500">{serviceTypes.length} selected</div>
          </div>

          <CheckboxGroup
            options={serviceTypeOptions}
            value={serviceTypes}
            onChange={(v) => form.setValue("serviceTypes", v, { shouldValidate: true })}
          />

          {serviceTypes.includes("Other") ? (
            <div className="pt-2">
              <Input
                value={form.watch("otherServiceType") ?? ""}
                onChange={(e) => form.setValue("otherServiceType", e.target.value, { shouldValidate: true })}
                placeholder="Please specify"
                maxLength={100}
              />
              {form.formState.errors.otherServiceType ? (
                <div className="mt-1 text-xs text-red-600">{form.formState.errors.otherServiceType.message}</div>
              ) : null}
            </div>
          ) : null}

          {form.formState.errors.serviceTypes ? (
            <div className="text-xs text-red-600">{form.formState.errors.serviceTypes.message as any}</div>
          ) : null}
        </section>

        <section className="space-y-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Client Age Groups *</div>
              <div className="text-xs text-zinc-600">Select all that apply</div>
            </div>
            <div className="text-xs text-zinc-500">{form.watch("ageGroups").length} selected</div>
          </div>

          <CheckboxGroup
            options={ageGroupOptions}
            value={form.watch("ageGroups")}
            onChange={(v) => form.setValue("ageGroups", v, { shouldValidate: true })}
          />

          {form.formState.errors.ageGroups ? (
            <div className="text-xs text-red-600">{form.formState.errors.ageGroups.message as any}</div>
          ) : null}
        </section>

        <section className="space-y-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Insurance Types Accepted *</div>
              <div className="text-xs text-zinc-600">Select all that apply</div>
            </div>
            <div className="text-xs text-zinc-500">{insuranceTypes.length} selected</div>
          </div>

          <CheckboxGroup
            options={insuranceOptions}
            value={insuranceTypes}
            onChange={(v) => form.setValue("insuranceTypes", v, { shouldValidate: true })}
          />

          {insuranceTypes.includes("Other") ? (
            <div className="pt-2">
              <Input
                value={form.watch("otherInsuranceType") ?? ""}
                onChange={(e) => form.setValue("otherInsuranceType", e.target.value, { shouldValidate: true })}
                placeholder="Please specify"
                maxLength={100}
              />
              {form.formState.errors.otherInsuranceType ? (
                <div className="mt-1 text-xs text-red-600">{form.formState.errors.otherInsuranceType.message}</div>
              ) : null}
            </div>
          ) : null}

          {form.formState.errors.insuranceTypes ? (
            <div className="text-xs text-red-600">{form.formState.errors.insuranceTypes.message as any}</div>
          ) : null}
        </section>

        <OnboardingButtons
          backDisabled={saving}
          continueDisabled={!canContinue}
          loading={saving}
          onBack={() => router.push("/onboarding/admin/step-1")}
          onContinue={form.handleSubmit(submit)}
        />
      </CardContent>
    </Card>
  );
}
