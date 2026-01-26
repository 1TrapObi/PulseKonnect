import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { DashboardShell } from "@/components/shared/dashboard-shell";

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

export default async function DashboardHomePage() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard");
  }

  const admin = createSupabaseAdminClient();
  const orgId = await getOrgIdForUser(admin, user.id);
  if (!orgId) {
    redirect("/onboarding/admin");
  }

  const { data: orgRow } = await admin
    .from("organizations")
    .select("onboarding_completed")
    .eq("id", orgId)
    .maybeSingle();

  if (!Boolean((orgRow as any)?.onboarding_completed)) {
    redirect("/onboarding/admin");
  }

  return (
    <DashboardShell title="Dashboard">
      <div className="space-y-4">
        <div className="rounded-xl border bg-white p-5">
          <h2 className="text-base font-semibold text-zinc-900">
            Welcome to Pulse Konnect
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Use the navigation to manage leads, candidates, and settings.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/leads"
            className="rounded-xl border bg-white p-5 hover:bg-zinc-50"
          >
            <div className="text-sm font-medium text-zinc-900">Leads</div>
            <div className="mt-1 text-sm text-zinc-600">
              Capture, track, and follow up.
            </div>
          </Link>

          <Link
            href="/candidates"
            className="rounded-xl border bg-white p-5 hover:bg-zinc-50"
          >
            <div className="text-sm font-medium text-zinc-900">Candidates</div>
            <div className="mt-1 text-sm text-zinc-600">
              Start building your pipeline.
            </div>
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}
