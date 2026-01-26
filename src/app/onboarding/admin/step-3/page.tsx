import { redirect } from "next/navigation";

import { OnboardingLayout } from "@/components/onboarding/admin/onboarding-layout";
import { Step3Form } from "@/components/onboarding/admin/step-3-form";
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

export default async function AdminOnboardingStep3Page() {
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
  if (step < 3) redirect(`/onboarding/admin/step-${Math.max(1, step)}`);
  if (step > 3) redirect(`/onboarding/admin/step-${Math.min(5, step)}`);

  const { data: prefs } = await admin
    .from("lead_preferences")
    .select("lead_sources,volume_goal,assignment_method,email_high_priority,daily_digest,weekly_report")
    .eq("organization_id", orgId)
    .maybeSingle();

  const initialValues: any = {
    leadSources: (prefs as any)?.lead_sources ?? [],
    volumeGoal: (prefs as any)?.volume_goal ?? "medium",
    assignmentMethod: (prefs as any)?.assignment_method ?? "manual",
    emailHighPriority: Boolean((prefs as any)?.email_high_priority ?? true),
    dailyDigest: Boolean((prefs as any)?.daily_digest ?? false),
    weeklyReport: Boolean((prefs as any)?.weekly_report ?? true),
  };

  return (
    <OnboardingLayout currentStep={3}>
      <Step3Form initialValues={initialValues} />
    </OnboardingLayout>
  );
}
