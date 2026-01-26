import { NextResponse } from "next/server";
import crypto from "crypto";
import * as React from "react";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { TeamInvitationEmail, teamInvitationSubject } from "@/lib/email/templates/team-invitation";
import { testPostConnection } from "@/lib/integrations/post";
import { step5Schema } from "@/lib/validation/onboarding-schemas";

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

export async function GET() {
  try {
    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const orgId = await getOrgIdForUser(admin, user.id);
    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Missing organization" }, { status: 500 });
    }

    const { data: org } = await admin
      .from("organizations")
      .select("post_api_key,post_connected")
      .eq("id", orgId)
      .maybeSingle();

    const { data: settings } = await admin
      .from("email_notification_settings")
      .select("high_priority_leads,new_candidates,weekly_summary,system_updates")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: invites } = await admin
      .from("team_invitations")
      .select("email,role,status")
      .eq("organization_id", orgId)
      .eq("status", "pending");

    return NextResponse.json({
      ok: true,
      hasPostAccount: Boolean((org as any)?.post_api_key),
      postApiKey: (org as any)?.post_api_key ?? "",
      postConnected: Boolean((org as any)?.post_connected ?? false),
      emailNotifications: {
        highPriorityLeads: Boolean((settings as any)?.high_priority_leads ?? true),
        newCandidates: Boolean((settings as any)?.new_candidates ?? true),
        weeklySummary: Boolean((settings as any)?.weekly_summary ?? false),
        systemUpdates: Boolean((settings as any)?.system_updates ?? false),
      },
      teamInvitations: (invites ?? []).map((i: any) => ({ email: i.email, role: i.role })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = step5Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues?.[0]?.message ?? "Invalid payload" });
    }

    const admin = createSupabaseAdminClient();
    const orgId = await getOrgIdForUser(admin, user.id);
    if (!orgId) {
      return NextResponse.json({ success: false, error: "Missing organization" }, { status: 500 });
    }

    let postConnected = false;

    if (parsed.data.hasPostAccount) {
      const apiKey = String(parsed.data.postApiKey ?? "").trim();
      const result = await testPostConnection(apiKey);
      if (!result.connected) {
        return NextResponse.json({ success: false, error: result.error ?? "Post connection failed" }, { status: 400 });
      }

      const { error } = await admin
        .from("organizations")
        .update({ post_api_key: apiKey, post_connected: true })
        .eq("id", orgId);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      postConnected = true;
    } else {
      await admin.from("organizations").update({ post_api_key: null, post_connected: false }).eq("id", orgId);
    }

    const { error: settingsErr } = await admin
      .from("email_notification_settings")
      .upsert(
        {
          user_id: user.id,
          high_priority_leads: parsed.data.emailNotifications.highPriorityLeads,
          new_candidates: parsed.data.emailNotifications.newCandidates,
          weekly_summary: parsed.data.emailNotifications.weeklySummary,
          system_updates: parsed.data.emailNotifications.systemUpdates,
        },
        { onConflict: "user_id" }
      );

    if (settingsErr) {
      return NextResponse.json({ success: false, error: settingsErr.message }, { status: 500 });
    }

    const invites = parsed.data.teamInvitations ?? [];

    if (invites.length) {
      const { data: org } = await admin.from("organizations").select("name").eq("id", orgId).maybeSingle();
      const { data: inviter } = await admin.from("users").select("email").eq("id", user.id).maybeSingle();

      for (const inv of invites) {
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const { error: insErr } = await admin
          .from("team_invitations")
          .insert([
            {
              organization_id: orgId,
              email: inv.email,
              role: inv.role,
              invited_by: user.id,
              token,
              expires_at: expiresAt,
            },
          ]);

        if (insErr) {
          return NextResponse.json({ success: false, error: insErr.message }, { status: 500 });
        }

        const invitationLink = buildInvitationLink(token);

        await sendEmail({
          to: inv.email,
          subject: teamInvitationSubject(String((org as any)?.name ?? "your organization")),
          react: React.createElement(TeamInvitationEmail, {
            inviterName: String((inviter as any)?.email ?? "A teammate"),
            organizationName: String((org as any)?.name ?? "your organization"),
            invitationLink,
            role: inv.role as any,
          }),
        });
      }
    }

    const { error: orgErr } = await admin
      .from("organizations")
      .update({ onboarding_completed: true, onboarding_step: 5 })
      .eq("id", orgId);

    if (orgErr) {
      return NextResponse.json({ success: false, error: orgErr.message }, { status: 500 });
    }

    await admin
      .from("users")
      .update({ onboarding_completed: true, onboarded_at: new Date().toISOString() })
      .eq("id", user.id);

    return NextResponse.json({ success: true, redirect: "/dashboard", postConnected });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
