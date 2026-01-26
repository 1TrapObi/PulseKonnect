import { redirect } from "next/navigation";

import { OnboardingLayout } from "@/components/onboarding/admin/onboarding-layout";
import { Step4Form } from "@/components/onboarding/admin/step-4-form";
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

export default async function AdminOnboardingStep4Page() {
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
  if (step < 4) redirect(`/onboarding/admin/step-${Math.max(1, step)}`);
  if (step > 4) redirect(`/onboarding/admin/step-${Math.min(5, step)}`);

  const { data: prefs } = await admin
    .from("recruitment_preferences")
    .select("candidate_sources,hiring_volume")
    .eq("organization_id", orgId)
    .maybeSingle();

  const { data: positions } = await admin
    .from("positions")
    .select("title,required_licenses,experience_level,employment_type,required_specializations,salary_min,salary_max,internal_notes")
    .eq("organization_id", orgId)
    .eq("internal_notes", "onboarding_step4");

  const initialValues: any = {
    skipPositions: (positions?.length ?? 0) === 0,
    positions:
      (positions ?? []).map((p: any) => ({
        title: p.title ?? "",
        requiredLicenses: p.required_licenses ?? [],
        experienceLevel: p.experience_level ?? "mid",
        employmentType: p.employment_type ?? "full_time",
        specializations: p.required_specializations ?? [],
        salaryMin: p.salary_min != null ? Number(p.salary_min) : undefined,
        salaryMax: p.salary_max != null ? Number(p.salary_max) : undefined,
      })) ?? [],
    candidateSources: (prefs as any)?.candidate_sources ?? [],
    hiringVolume: (prefs as any)?.hiring_volume ?? "",
  };

  return (
    <OnboardingLayout currentStep={4}>
      <Step4Form initialValues={initialValues} />
    </OnboardingLayout>
  );
}
