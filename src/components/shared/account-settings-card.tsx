"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AccountPayload = {
  ok: boolean;
  account?: {
    id: string;
    email: string;
    role: string;
    createdAt: string;
  };
  error?: string;
};

export function AccountSettingsCard() {
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [signingOutAll, setSigningOutAll] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [account, setAccount] = React.useState<AccountPayload["account"] | null>(null);

  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const canSavePassword =
    newPassword.trim().length >= 8 &&
    confirmPassword.trim().length >= 8 &&
    newPassword.trim() === confirmPassword.trim();

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/account");
      const json = (await res.json().catch(() => ({}))) as Partial<AccountPayload>;
      if (!res.ok || !json.ok) {
        setError(String(json.error ?? "Failed to load account settings"));
        return;
      }
      setAccount(json.account as any);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function savePassword() {
    if (!canSavePassword) {
      setError("Passwords must match and be at least 8 characters");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/account", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newPassword: newPassword.trim() }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(String(json.error ?? "Password update failed"));
        return;
      }

      setNewPassword("");
      setConfirmPassword("");
      await load();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  async function signOutAll() {
    setSigningOutAll(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/account/signout-all", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(String(json.error ?? "Sign out failed"));
        return;
      }

      window.location.href = "/login";
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSigningOutAll(false);
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
            <CardTitle>Account</CardTitle>
            <div className="mt-1 text-sm text-zinc-600">Manage your account security.</div>
          </div>
          <Button type="button" variant="outline" onClick={load}>
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</div>
        ) : null}

        <section className="space-y-2">
          <div className="text-sm font-semibold text-zinc-900">Account details</div>
          <div className="rounded-md border bg-white p-3 text-sm">
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <div className="text-xs text-zinc-500">Email</div>
                <div className="text-zinc-900">{account?.email ?? ""}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Role</div>
                <div className="text-zinc-900">{account?.role ?? ""}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">User ID</div>
                <div className="break-all text-zinc-900">{account?.id ?? ""}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Created</div>
                <div className="text-zinc-900">
                  {account?.createdAt ? new Date(account.createdAt).toLocaleString() : ""}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Change password</div>
            <div className="text-xs text-zinc-600">Minimum 8 characters.</div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <div className="text-sm font-medium">New password</div>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium">Confirm password</div>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Button type="button" disabled={!canSavePassword || saving} onClick={savePassword}>
              {saving ? "Saving…" : "Update password"}
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Sessions</div>
            <div className="text-xs text-zinc-600">Sign out across all devices.</div>
          </div>

          <div className="flex items-center justify-end">
            <Button type="button" variant="outline" disabled={signingOutAll} onClick={signOutAll}>
              {signingOutAll ? "Signing out…" : "Sign out all devices"}
            </Button>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
