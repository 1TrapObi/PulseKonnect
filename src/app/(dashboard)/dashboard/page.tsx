import Link from "next/link";
import { redirect } from "next/navigation";

import { GettingStartedChecklist } from "@/components/dashboard/getting-started-checklist";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { HelpTip } from "@/components/ui/help-tip";

export default async function DashboardHomePage() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard");
  }

  const admin = createSupabaseAdminClient();
  const { data: userRow, error: userErr } = await admin
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .limit(1)
    .maybeSingle();

  const orgId = userErr || !userRow?.organization_id ? null : String(userRow.organization_id);
  if (!orgId) {
    redirect("/onboarding/admin");
  }

  const { data: orgRow } = await admin
    .from("organizations")
    .select("onboarding_completed")
    .eq("id", orgId)
    .maybeSingle();

  if (!Boolean(orgRow?.onboarding_completed)) {
    redirect("/onboarding/admin");
  }

  return (
    <DashboardShell title="Dashboard">
      <div className="space-y-4">
        <GettingStartedChecklist />

        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-zinc-900">
              Welcome to Pulse Konnect
            </h2>
            <div className="flex items-center gap-2">
              <Link
                href="/leads"
                data-tour="new-lead-button"
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                New Lead
              </Link>
              <HelpTip text="Click here to manually add a new lead." />
            </div>
          </div>
          <p className="mt-1 text-sm text-zinc-600">
            Use the navigation to manage leads, candidates, and settings.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2" data-tour="dashboard-cards">
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

        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-900">Recent Activity</h3>
            <HelpTip text="Your team's latest actions on leads." />
          </div>
          <p className="mt-1 text-sm text-zinc-600">
            Open a lead to view status updates, notes, and reminders in its timeline.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
