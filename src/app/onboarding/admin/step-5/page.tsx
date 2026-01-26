import { redirect } from "next/navigation";

import { OnboardingLayout } from "@/components/onboarding/admin/onboarding-layout";
import { Step5Form } from "@/components/onboarding/admin/step-5-form";
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

export default async function AdminOnboardingStep5Page() {
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
  if (step < 5) redirect(`/onboarding/admin/step-${Math.max(1, step)}`);

  const { data: orgSettings } = await admin
    .from("organizations")
    .select("post_api_key,post_connected")
    .eq("id", orgId)
    .maybeSingle();

  const { data: emailSettings } = await admin
    .from("email_notification_settings")
    .select("high_priority_leads,new_candidates,weekly_summary,system_updates")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: invites } = await admin
    .from("team_invitations")
    .select("email,role,status")
    .eq("organization_id", orgId)
    .eq("status", "pending");

  const initialValues: any = {
    hasPostAccount: Boolean((orgSettings as any)?.post_api_key),
    postApiKey: (orgSettings as any)?.post_api_key ?? "",
    emailNotifications: {
      highPriorityLeads: Boolean((emailSettings as any)?.high_priority_leads ?? true),
      newCandidates: Boolean((emailSettings as any)?.new_candidates ?? true),
      weeklySummary: Boolean((emailSettings as any)?.weekly_summary ?? false),
      systemUpdates: Boolean((emailSettings as any)?.system_updates ?? false),
    },
    teamInvitations: (invites ?? []).map((i: any) => ({ email: i.email, role: i.role })),
  };

  return (
    <OnboardingLayout currentStep={5}>
      <Step5Form initialValues={initialValues} />
    </OnboardingLayout>
  );
}
