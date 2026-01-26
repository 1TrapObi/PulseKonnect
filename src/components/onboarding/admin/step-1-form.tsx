"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OnboardingButtons } from "@/components/onboarding/admin/onboarding-buttons";
import { PhoneInput } from "@/components/onboarding/admin/phone-input";
import { ServiceAreasCheckboxes } from "@/components/onboarding/admin/service-areas-checkboxes";
import { step1Schema, type Step1FormData } from "@/lib/validation/onboarding-schemas";
import { useOnboardingStore } from "@/lib/store/onboarding-store";

const STORAGE_KEY = "pk_onboarding_admin_step1";

export function Step1Form({
  initialValues,
}: {
  initialValues?: Partial<Step1FormData>;
}) {
  const router = useRouter();
  const { setCurrentStep, setOrganizationProfile } = useOnboardingStore();

  const [otherChecked, setOtherChecked] = React.useState(false);
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved">("idle");
  const [apiError, setApiError] = React.useState<string | null>(null);

  const form = useForm<Step1FormData>({
    resolver: zodResolver(step1Schema),
    mode: "onChange",
    defaultValues: {
      organizationName: initialValues?.organizationName ?? "",
      contactName: initialValues?.contactName ?? "",
      phone: initialValues?.phone ?? "",
      serviceAreas: initialValues?.serviceAreas ?? [],
      otherServiceArea: initialValues?.otherServiceArea ?? "",
    },
  });

  React.useEffect(() => {
    setCurrentStep(1);
  }, [setCurrentStep]);

  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const r = step1Schema.partial().safeParse(parsed);
      if (!r.success) return;
      form.reset({
        organizationName: r.data.organizationName ?? form.getValues("organizationName"),
        contactName: r.data.contactName ?? form.getValues("contactName"),
        phone: r.data.phone ?? form.getValues("phone"),
        serviceAreas: r.data.serviceAreas ?? form.getValues("serviceAreas"),
        otherServiceArea: r.data.otherServiceArea ?? form.getValues("otherServiceArea"),
      });
      if (r.data.otherServiceArea && String(r.data.otherServiceArea).trim()) {
        setOtherChecked(true);
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

  const saving = form.formState.isSubmitting;
  const canContinue = form.formState.isValid && !saving;

  async function submit() {
    setApiError(null);
    const values = form.getValues();

    const parsed = step1Schema.safeParse({
      ...values,
      otherServiceArea: otherChecked ? values.otherServiceArea : undefined,
    });

    if (!parsed.success) {
      parsed.error.issues.forEach((i) => {
        const field = String(i.path?.[0] ?? "");
        if (field) form.setError(field as any, { message: i.message });
      });
      return;
    }

    try {
      const res = await fetch("/api/onboarding/admin/step-1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setApiError(json.error ?? "Save failed");
        return;
      }

      setOrganizationProfile({
        name: parsed.data.organizationName,
        contactName: parsed.data.contactName,
        phone: parsed.data.phone,
        serviceAreas: parsed.data.serviceAreas,
        otherServiceArea: parsed.data.otherServiceArea,
      });

      try {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // noop
      }

      router.push(json.nextStep ?? "/onboarding/admin/step-2");
    } catch (e: any) {
      setApiError(e?.message ?? "Save failed");
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Welcome to PulseKonnect!</CardTitle>
            <div className="mt-1 text-sm text-zinc-600">
              Let&apos;s get your organization set up. This will only take a few minutes.
            </div>
          </div>
          <div className="text-xs text-zinc-500">
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {apiError ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {apiError}
          </div>
        ) : null}

        <div className="space-y-1">
          <div className="text-sm font-medium">Organization Name *</div>
          <Input {...form.register("organizationName")} placeholder="Carolina Community Support Services" maxLength={200} />
          {form.formState.errors.organizationName ? (
            <div className="text-xs text-red-600">{form.formState.errors.organizationName.message}</div>
          ) : null}
        </div>

        <div className="space-y-1">
          <div className="text-sm font-medium">Primary Contact Name *</div>
          <Input {...form.register("contactName")} placeholder="John Doe" maxLength={100} />
          {form.formState.errors.contactName ? (
            <div className="text-xs text-red-600">{form.formState.errors.contactName.message}</div>
          ) : null}
        </div>

        <div className="space-y-1">
          <div className="text-sm font-medium">Phone Number *</div>
          <PhoneInput
            value={form.watch("phone")}
            onChange={(v) => form.setValue("phone", v, { shouldValidate: true })}
            placeholder="(919) 555-0123"
          />
          {form.formState.errors.phone ? (
            <div className="text-xs text-red-600">{form.formState.errors.phone.message}</div>
          ) : null}
        </div>

        <div className="space-y-1">
          <div className="text-sm font-medium">Service Areas *</div>
          <ServiceAreasCheckboxes
            value={form.watch("serviceAreas")}
            onChange={(v) => form.setValue("serviceAreas", v, { shouldValidate: true })}
            otherChecked={otherChecked}
            onOtherCheckedChange={(v) => {
              setOtherChecked(v);
              if (!v) form.setValue("otherServiceArea", "", { shouldValidate: true });
            }}
            otherValue={form.watch("otherServiceArea") ?? ""}
            onOtherValueChange={(v) => form.setValue("otherServiceArea", v, { shouldValidate: true })}
          />
          {form.formState.errors.serviceAreas ? (
            <div className="text-xs text-red-600">{form.formState.errors.serviceAreas.message as any}</div>
          ) : null}
        </div>

        <OnboardingButtons
          backDisabled
          continueDisabled={!canContinue}
          loading={saving}
          onBack={() => {}}
          onContinue={form.handleSubmit(submit)}
        />
      </CardContent>
    </Card>
  );
}
