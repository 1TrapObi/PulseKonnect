import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/shared/dashboard-shell";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { LeadDetails } from "./lead-details";

export default async function LeadDetailsPage({
  params,
}: {
  params: { id?: string } | Promise<{ id?: string }>;
}) {
  const { id } = await Promise.resolve(params as any);
  if (!id) {
    notFound();
  }

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    notFound();
  }

  const admin = createSupabaseAdminClient();

  const { data: userRowById, error: userByIdErr } = await admin
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (userByIdErr) {
    throw new Error(userByIdErr.message);
  }

  const { data: userRowByEmail, error: userByEmailErr } =
    !userRowById?.organization_id && user.email
      ? await admin
          .from("users")
          .select("organization_id")
          .eq("email", user.email)
          .maybeSingle()
      : { data: null, error: null };

  if (userByEmailErr) {
    throw new Error(userByEmailErr.message);
  }

  const orgId =
    (userRowById?.organization_id as string | undefined) ??
    (userRowByEmail?.organization_id as string | undefined);
  if (!orgId) {
    notFound();
  }

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .select(
      "id,name,first_name,last_name,email,phone,phone_home,date_of_birth,address_line1,city,state,zip,insurance_type,insurance_payer,insurance_id,need_type,location,source,source_url,status,urgency,qualification_status,qualification_score,created_at,assigned_to,contacted_at,response_time_hours,lost_reason"
    )
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (leadErr) {
    throw new Error(leadErr.message);
  }

  if (!lead) {
    notFound();
  }

  const { data: team, error: teamErr } = await admin
    .from("users")
    .select("id,email,role")
    .eq("organization_id", orgId)
    .in("role", ["staff", "admin"])
    .order("email", { ascending: true });

  if (teamErr) {
    throw new Error(teamErr.message);
  }

  return (
    <DashboardShell title="Lead Details">
      <LeadDetails lead={lead as any} team={(team as any) ?? []} currentUserId={user.id} />
    </DashboardShell>
  );
}
