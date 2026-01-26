import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/shared/dashboard-shell";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { CandidateProfile } from "./candidate-profile";

export default async function CandidateProfilePage({
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

  const { data: userRow } = await admin
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  const orgId = userRow?.organization_id as string | undefined;
  if (!orgId) {
    notFound();
  }

  const full = await admin
    .from("candidates")
    .select(
      "id,name,email,phone,license_type,license_number,experience_years,experience_level,specializations,location,current_employer,resume_url,resume_text,source,source_url,status,fit_score,qualification_status,matched_positions,created_at,updated_at"
    )
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();

  const fallback =
    full.error || !full.data
      ? await admin
          .from("candidates")
          .select(
            "id,name,email,phone,license_type,license_number,experience_years,specializations,location,current_employer,resume_url,resume_text,source,source_url,status,fit_score,created_at,updated_at"
          )
          .eq("id", id)
          .eq("organization_id", orgId)
          .maybeSingle()
      : null;

  const candidate = (full.data ?? fallback?.data) as any;
  if (!candidate) {
    notFound();
  }

  const { data: team } = await admin
    .from("users")
    .select("id,email,role")
    .eq("organization_id", orgId)
    .in("role", ["staff", "admin"])
    .order("email", { ascending: true });

  let positions: Array<{ id: string; title: string }> = [];
  try {
    const { data: p } = await admin
      .from("positions")
      .select("id,title")
      .eq("organization_id", orgId)
      .order("title", { ascending: true });

    positions = (p ?? []).map((row: any) => ({ id: String(row.id), title: String(row.title ?? row.id) }));
  } catch {
    positions = [];
  }

  return (
    <DashboardShell title="Candidate Profile">
      <CandidateProfile
        candidate={candidate}
        team={(team as any) ?? []}
        positions={positions}
        currentUserId={user.id}
      />
    </DashboardShell>
  );
}
