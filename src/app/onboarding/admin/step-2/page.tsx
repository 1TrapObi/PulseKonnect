import { redirect } from "next/navigation";

import { OnboardingLayout } from "@/components/onboarding/admin/onboarding-layout";
import { Step2Form } from "@/components/onboarding/admin/step-2-form";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";

async function getOrgIdForUser(admin: any, userId: string) {
  const { data: userRow, error } = await admin
    .from("users")
    .select("organization_id")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();

  if (error || !userRow?.organization_id) return null;
  return userRow.organization_id as string;
}

export default async function AdminOnboardingStep2Page() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/onboarding/admin");
  }

  const admin = createSupabaseAdminClient();
  const orgId = await getOrgIdForUser(admin, user.id);
  if (!orgId) {
    redirect("/dashboard");
  }

  const { data: org } = await admin
    .from("organizations")
    .select("onboarding_step,onboarding_completed")
    .eq("id", orgId)
    .maybeSingle();

  const completed = Boolean((org as any)?.onboarding_completed);
  if (completed) {
    redirect("/dashboard");
  }

  const step = Number((org as any)?.onboarding_step ?? 1);
  if (step < 2) redirect("/onboarding/admin/step-1");
  if (step > 2) redirect(`/onboarding/admin/step-${Math.min(5, step)}`);

  const { data: profile } = await admin
    .from("organization_profiles")
    .select("service_types,other_service_type,age_groups,insurance_types,other_insurance_type")
    .eq("organization_id", orgId)
    .maybeSingle();

  const initialValues: any = {
    serviceTypes: (profile as any)?.service_types ?? [],
    otherServiceType: (profile as any)?.other_service_type ?? "",
    ageGroups: (profile as any)?.age_groups ?? [],
    insuranceTypes: (profile as any)?.insurance_types ?? [],
    otherInsuranceType: (profile as any)?.other_insurance_type ?? "",
  };

  return (
    <OnboardingLayout currentStep={2}>
      <Step2Form initialValues={initialValues} />
    </OnboardingLayout>
  );
}
