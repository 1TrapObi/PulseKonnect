import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { canDelete, normalizeRole } from "@/lib/auth/rbac";

type UserOrgRow = { organization_id: string | null; role: string | null };

type BulkDeleteBody = {
  ids?: string[];
};

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((v) => String(v).trim()).filter(Boolean)));
}

export async function POST(request: Request) {
  try {
    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as BulkDeleteBody | null;
    const ids = uniqueStrings(body?.ids);

    if (!ids.length) {
      return NextResponse.json({ ok: false, error: "No lead IDs provided" }, { status: 400 });
    }

    if (ids.length > 500) {
      return NextResponse.json({ ok: false, error: "Too many IDs (max 500)" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    const { data: userRow, error: userErr } = await admin
      .from("users")
      .select("organization_id,role")
      .eq("id", user.id)
      .limit(1)
      .maybeSingle<UserOrgRow>();

    if (userErr || !userRow?.organization_id) {
      return NextResponse.json(
        { ok: false, error: userErr?.message ?? "Missing organization" },
        { status: 500 }
      );
    }

    const orgId = userRow.organization_id;
    const role = normalizeRole(userRow.role);

    if (!canDelete({ userId: user.id, email: user.email ?? null, role, organizationId: orgId, isSuperAdmin: role === "super_admin" })) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    let deleteQuery = admin
      .from("leads")
      .delete()
      .in("id", ids)
      .select("id");

    if (role !== "super_admin") {
      deleteQuery = deleteQuery.eq("organization_id", orgId);
    }

    const { data, error } = await deleteQuery;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const deletedCount = Array.isArray(data) ? data.length : 0;

    return NextResponse.json({ ok: true, deleted: deletedCount });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
