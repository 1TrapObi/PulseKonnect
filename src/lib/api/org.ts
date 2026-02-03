import { createSupabaseAdminClient } from "@/lib/db/supabase/server";

export async function getOrgIdForUser(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("organization_id")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();

  if (error || !data?.organization_id) {
    throw new Error(error?.message ?? "Missing organization");
  }

  return String((data as any).organization_id);
}
