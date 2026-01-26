"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "/dashboard");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(
      `/login?redirect=${encodeURIComponent(redirectTo)}&error=${encodeURIComponent(error.message)}`
    );
  }

  redirect(redirectTo);
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  const authUserId = data.user?.id;
  if (authUserId) {
    const hasSession = Boolean(data.session);
    if (!hasSession) {
      await supabase.auth.signInWithPassword({ email, password });
    }

    const admin = createSupabaseAdminClient();

    const { data: existingUser } = await admin
      .from("users")
      .select("id")
      .eq("id", authUserId)
      .maybeSingle();

    if (!existingUser?.id) {
      const orgName = email.includes("@") ? email.split("@")[0] : "New Organization";

      const { data: orgRow, error: orgErr } = await admin
        .from("organizations")
        .insert({ name: orgName })
        .select("id")
        .maybeSingle();

      if (!orgErr && orgRow?.id) {
        await admin.from("users").insert({
          id: authUserId,
          email,
          role: "admin",
          organization_id: orgRow.id,
        });
      }
    }
  }

  redirect("/onboarding/admin");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
