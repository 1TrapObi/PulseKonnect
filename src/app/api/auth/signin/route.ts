import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "/dashboard");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const url = new URL("/login", request.url);
    if (redirectTo) url.searchParams.set("redirect", redirectTo);
    url.searchParams.set("error", error.message);
    return NextResponse.redirect(url, { status: 303 });
  }

  // Ensure app-level user row exists for older accounts.
  // Without this, /dashboard will redirect to onboarding because it can’t find users.organization_id.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id) {
      const admin = createSupabaseAdminClient();

      let orgIdToUse: string | null = null;

      const { data: existingUser } = await admin
        .from("users")
        .select("id,organization_id,role")
        .eq("id", user.id)
        .maybeSingle();

      if (!existingUser?.id) {
        const orgName = email.includes("@");
        const defaultName = orgName ? email.split("@")[0] : "New Organization";

        const { data: orgRow, error: orgErr } = await admin
          .from("organizations")
          .insert({ name: defaultName })
          .select("id")
          .maybeSingle();

        if (!orgErr && orgRow?.id) {
          orgIdToUse = orgRow.id;
          await admin.from("users").insert({
            id: user.id,
            email,
            role: "admin",
            organization_id: orgRow.id,
          });
        }
      } else if (!existingUser.organization_id) {
        const defaultName = email.includes("@") ? email.split("@")[0] : "New Organization";

        const { data: orgRow, error: orgErr } = await admin
          .from("organizations")
          .insert({ name: defaultName })
          .select("id")
          .maybeSingle();

        if (!orgErr && orgRow?.id) {
          orgIdToUse = orgRow.id;
          await admin
            .from("users")
            .update({ organization_id: orgRow.id })
            .eq("id", user.id);
        }
      } else {
        orgIdToUse = String(existingUser.organization_id);
      }

      // Bootstrap admin account: skip onboarding and go straight to dashboard.
      if (email.toLowerCase() === "obi@pulsekonnect.com" && orgIdToUse) {
        await admin
          .from("organizations")
          .update({ onboarding_completed: true, onboarding_step: 5 })
          .eq("id", orgIdToUse);

        // This column exists only after CCSS-017 migration; best-effort.
        await admin
          .from("users")
          .update({ onboarding_completed: true, onboarded_at: new Date().toISOString() })
          .eq("id", user.id);
      }
    }
  } catch {
    // best effort; never block sign-in
  }

  const url = new URL(redirectTo || "/dashboard", request.url);
  return NextResponse.redirect(url, { status: 303 });
}
