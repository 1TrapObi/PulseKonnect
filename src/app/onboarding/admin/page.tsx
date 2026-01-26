import { redirect } from "next/navigation";

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

export default async function AdminOnboardingEntry() {
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

  const { data: orgRow } = await admin
    .from("organizations")
    .select("onboarding_step,onboarding_completed")
    .eq("id", orgId)
    .maybeSingle();

  const completed = Boolean((orgRow as any)?.onboarding_completed);
  if (completed) {
    redirect("/dashboard");
  }

  const step = Number((orgRow as any)?.onboarding_step ?? 1);
  const normalized = Number.isFinite(step) ? Math.min(5, Math.max(1, step)) : 1;

  redirect(`/onboarding/admin/step-${normalized}`);
}
