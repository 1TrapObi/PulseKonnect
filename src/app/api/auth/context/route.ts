import { NextResponse } from "next/server";

import { getAuthContext, roleLabel } from "@/lib/auth/rbac";

export async function GET() {
  const ctx = await getAuthContext();

  if (!ctx) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: ctx.userId,
      email: ctx.email,
      role: ctx.role,
      roleLabel: roleLabel(ctx.role),
      organizationId: ctx.organizationId,
    },
  });
}
