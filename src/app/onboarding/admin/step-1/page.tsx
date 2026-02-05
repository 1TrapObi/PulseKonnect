import { redirect } from "next/navigation";

import { OnboardingLayout } from "@/components/onboarding/admin/onboarding-layout";
import { Step1Form } from "@/components/onboarding/admin/step-1-form";
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

export default async function AdminOnboardingStep1Page() {
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
    .select("name,contact_phone,onboarding_step,onboarding_completed,service_areas")
    .eq("id", orgId)
    .maybeSingle();

  const completed = Boolean((org as any)?.onboarding_completed);
  if (completed) {
    redirect("/dashboard");
  }

  const { data: profile } = await admin
    .from("organization_profiles")
    .select("contact_name,contact_phone,service_areas,other_service_area")
    .eq("organization_id", orgId)
    .maybeSingle();

  const initialValues: any = {
    organizationName: (org as any)?.name ?? "",
    contactName: (profile as any)?.contact_name ?? "",
    phone: (profile as any)?.contact_phone ?? (org as any)?.contact_phone ?? "",
    serviceAreas: (profile as any)?.service_areas ?? (org as any)?.service_areas ?? [],
    otherServiceArea: (profile as any)?.other_service_area ?? "",
  };

  return (
    <OnboardingLayout currentStep={1}>
      <Step1Form initialValues={initialValues} />
    </OnboardingLayout>
  );
}
