import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";

export const ROLES = ["super_admin", "admin", "staff"] as const;
export type Role = (typeof ROLES)[number];

export type AuthContext = {
  userId: string;
  email: string | null;
  role: Role;
  organizationId: string | null;
  isSuperAdmin: boolean;
};

type UserRoleRow = {
  id: string;
  email: string | null;
  role: string | null;
  organization_id: string | null;
};

export function normalizeRole(role: string | null | undefined): Role {
  return ROLES.includes(role as Role) ? (role as Role) : "admin";
}

export function roleLabel(role: Role) {
  if (role === "super_admin") return "Super Admin";
  if (role === "admin") return "Admin";
  return "Staff";
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) return null;

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("users")
    .select("id,email,role,organization_id")
    .eq("id", user.id)
    .maybeSingle<UserRoleRow>();

  const role = normalizeRole(data?.role);

  return {
    userId: user.id,
    email: data?.email ?? user.email ?? null,
    role,
    organizationId: data?.organization_id ?? null,
    isSuperAdmin: role === "super_admin",
  };
}

export async function requireAuthContext() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return { ctx: null, response: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }
  return { ctx, response: null };
}

export async function requireRole(allowed: Role[]) {
  const { ctx, response } = await requireAuthContext();
  if (!ctx) return { ctx: null, response };
  if (!allowed.includes(ctx.role)) {
    return { ctx: null, response: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  }
  return { ctx, response: null };
}

export function canDelete(ctx: AuthContext) {
  return ctx.role === "super_admin" || ctx.role === "admin";
}

export function canManageUsers(ctx: AuthContext) {
  return ctx.role === "super_admin" || ctx.role === "admin";
}

export function canViewAnalytics(ctx: AuthContext) {
  return ctx.role === "super_admin" || ctx.role === "admin";
}
