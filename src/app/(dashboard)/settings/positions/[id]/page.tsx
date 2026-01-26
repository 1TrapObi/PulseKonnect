import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/shared/dashboard-shell";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { PositionDetails } from "./position-details";

export default async function PositionDetailsPage({
  params,
}: {
  params: { id?: string } | Promise<{ id?: string }>;
}) {
  const { id } = await Promise.resolve(params as any);
  if (!id) notFound();

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) notFound();

  const admin = createSupabaseAdminClient();

  const { data: userRow } = await admin
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  const orgId = userRow?.organization_id as string | undefined;
  if (!orgId) notFound();

  const { data: position } = await admin
    .from("positions")
    .select(
      "id,title,department,employment_type,num_openings,required_licenses,experience_level,required_specializations,preferred_specializations,salary_min,salary_max,pay_frequency,benefits,description,responsibilities,work_schedule,work_locations,application_deadline,status,internal_notes,posted_date,filled_date,created_by,created_at,updated_at"
    )
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!position) notFound();

  return (
    <DashboardShell title="Job Posting">
      <PositionDetails position={position as any} />
    </DashboardShell>
  );
}
