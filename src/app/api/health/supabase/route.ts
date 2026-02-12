import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/db/supabase/server";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKeyPresent = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const serviceRoleKeyPresent = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

    const missingEnv: string[] = [];
    if (!supabaseUrl) missingEnv.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!anonKeyPresent) missingEnv.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    if (!serviceRoleKeyPresent) missingEnv.push("SUPABASE_SERVICE_ROLE_KEY");

    const urlLooksValid = typeof supabaseUrl === "string" && /^https:\/\//.test(supabaseUrl);

    let authHealth: { ok: boolean; status?: number; error?: string } | null = null;
    if (supabaseUrl && urlLooksValid) {
      try {
        const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
          headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
          cache: "no-store",
        });
        authHealth = { ok: res.ok, status: res.status };
      } catch (e: any) {
        authHealth = { ok: false, error: e?.message ?? "Auth health fetch failed" };
      }
    }

    let dbSample: any[] | null = null;
    let dbError: string | null = null;

    if (supabaseUrl && serviceRoleKeyPresent) {
      try {
        const supabase = createSupabaseAdminClient();
        const { data, error } = await supabase.from("organizations").select("id").limit(1);
        if (error) dbError = error.message;
        else dbSample = data ?? [];
      } catch (e: any) {
        dbError = e?.message ?? "DB check failed";
      }
    }

    const ok = missingEnv.length === 0 && Boolean(authHealth?.ok) && !dbError;

    return NextResponse.json({
      ok,
      env: {
        supabaseUrlPresent: Boolean(supabaseUrl),
        supabaseUrlLooksValid: urlLooksValid,
        anonKeyPresent,
        serviceRoleKeyPresent,
        missingEnv,
      },
      authHealth,
      db: {
        ok: !dbError,
        error: dbError,
        organizationsSample: dbSample,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
