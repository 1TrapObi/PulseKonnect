import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = requestUrl.searchParams.get("next") ?? "/onboarding/admin";

  if (!token_hash || !type) {
    const url = new URL("/verify-email/error", request.url);
    url.searchParams.set("message", "Missing verification parameters.");
    return NextResponse.redirect(url);
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type: type as any,
  });

  if (error) {
    const url = new URL("/verify-email/error", request.url);
    url.searchParams.set("message", error.message);
    return NextResponse.redirect(url);
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const email = user?.email ?? "";

    if (user?.id) {
      const admin = createSupabaseAdminClient();

      const { data: existingUser } = await admin
        .from("users")
        .select("id")
        .eq("id", user.id)
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
            id: user.id,
            email,
            role: "admin",
            organization_id: orgRow.id,
          });
        }
      }
    }
  } catch {
    // best effort
  }

  return NextResponse.redirect(new URL(next, request.url));
}
