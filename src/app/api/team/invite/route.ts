import { NextResponse } from "next/server";
import crypto from "crypto";
import * as React from "react";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { TeamInvitationEmail, teamInvitationSubject } from "@/lib/email/templates/team-invitation";

async function getOrgIdForUser(admin: any, userId: string) {
  const { data: userRow, error } = await admin
    .from("users")
    .select("organization_id")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();

  if (error || !userRow?.organization_id) return null;
  return userRow.organization_id as string;
}

function buildInvitationLink(token: string) {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/invite/${encodeURIComponent(token)}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String((body as any).email ?? "").trim();
    const role = String((body as any).role ?? "staff").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ success: false, error: "Invalid email" }, { status: 400 });
    }
    if (!(role === "admin" || role === "staff" || role === "viewer")) {
      return NextResponse.json({ success: false, error: "Invalid role" }, { status: 400 });
    }

    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const orgId = await getOrgIdForUser(admin, user.id);
    if (!orgId) {
      return NextResponse.json({ success: false, error: "Missing organization" }, { status: 500 });
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: org } = await admin.from("organizations").select("name").eq("id", orgId).maybeSingle();
    const { data: inviter } = await admin.from("users").select("email").eq("id", user.id).maybeSingle();

    const { data: row, error } = await admin
      .from("team_invitations")
      .insert([
        {
          organization_id: orgId,
          email,
          role,
          invited_by: user.id,
          token,
          expires_at: expiresAt,
        },
      ])
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const invitationLink = buildInvitationLink(token);

    await sendEmail({
      to: email,
      subject: teamInvitationSubject(String((org as any)?.name ?? "your organization")),
      react: React.createElement(TeamInvitationEmail, {
        inviterName: String((inviter as any)?.email ?? "A teammate"),
        organizationName: String((org as any)?.name ?? "your organization"),
        invitationLink,
        role: role as any,
      }),
    });

    return NextResponse.json({ success: true, invitationId: (row as any)?.id ?? null });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
