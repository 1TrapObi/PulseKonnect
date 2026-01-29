"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Member = {
  id: string;
  email: string;
  role: string;
  created_at: string;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string | null;
};

type Payload = {
  ok: boolean;
  members: Member[];
  invitations: Invitation[];
  error?: string;
};

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "staff", label: "Staff" },
  { value: "viewer", label: "Viewer" },
] as const;

export function TeamSettingsCard() {
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [members, setMembers] = React.useState<Member[]>([]);
  const [invitations, setInvitations] = React.useState<Invitation[]>([]);

  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<(typeof ROLE_OPTIONS)[number]["value"]>("staff");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/team");
      const json = (await res.json().catch(() => ({}))) as Partial<Payload>;
      if (!res.ok || !json.ok) {
        setError(String(json.error ?? "Failed to load team settings"));
        return;
      }
      setMembers((json.members ?? []) as Member[]);
      setInvitations((json.invitations ?? []) as Invitation[]);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function sendInvite() {
    const email = inviteEmail.trim();
    if (!email) {
      setError("Email is required");
      return;
    }

    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role: inviteRole }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setError(String(json.error ?? "Invite failed"));
        return;
      }

      setInviteEmail("");
      await load();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <div className="rounded-xl border bg-white p-5 text-sm text-zinc-600">Loading…</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Team Management</CardTitle>
            <div className="mt-1 text-sm text-zinc-600">Invite teammates and view members and pending invites.</div>
          </div>
          <Button type="button" variant="outline" onClick={load}>
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</div> : null}

        <section className="space-y-2">
          <div className="text-sm font-semibold text-zinc-900">Invite a teammate</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-end">
            <div className="sm:col-span-7">
              <div className="text-xs text-zinc-600">Email</div>
              <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="name@example.com" />
            </div>
            <div className="sm:col-span-3">
              <div className="text-xs text-zinc-600">Role</div>
              <Select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
                options={ROLE_OPTIONS as any}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="button" className="w-full" disabled={sending} onClick={sendInvite}>
                {sending ? "Sending…" : "Send invite"}
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <div className="text-sm font-semibold text-zinc-900">Members</div>
          {members.length ? (
            <div className="divide-y rounded-md border bg-white">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate text-zinc-900">{m.email}</div>
                    <div className="text-xs text-zinc-500">Joined {new Date(m.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="shrink-0 rounded-md border bg-zinc-50 px-2 py-1 text-xs text-zinc-700">{m.role}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border bg-zinc-50 p-3 text-sm text-zinc-700">No members found.</div>
          )}
        </section>

        <section className="space-y-2">
          <div className="text-sm font-semibold text-zinc-900">Invitations</div>
          {invitations.length ? (
            <div className="divide-y rounded-md border bg-white">
              {invitations.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate text-zinc-900">{inv.email}</div>
                    <div className="text-xs text-zinc-500">
                      {inv.status} · {inv.expires_at ? `expires ${new Date(inv.expires_at).toLocaleDateString()}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 rounded-md border bg-zinc-50 px-2 py-1 text-xs text-zinc-700">{inv.role}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border bg-zinc-50 p-3 text-sm text-zinc-700">No invitations yet.</div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
