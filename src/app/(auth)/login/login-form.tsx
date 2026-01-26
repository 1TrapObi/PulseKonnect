"use client";

import * as React from "react";

export function LoginForm({ redirectTo, initialError }: { redirectTo: string; initialError?: string }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(initialError ?? null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const fd = new FormData();
      fd.set("email", email);
      fd.set("password", password);
      fd.set("redirect", redirectTo);

      const res = await fetch("/api/auth/signin", {
        method: "POST",
        body: fd,
        redirect: "follow",
      });

      const finalUrl = new URL(res.url);
      const err = finalUrl.searchParams.get("error");

      if (err) {
        setError(err);
        return;
      }

      if (!res.ok) {
        setError("Login failed. Please try again.");
        return;
      }

      window.location.href = finalUrl.toString();
    } catch (e: any) {
      setError(e?.message ?? "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <input type="hidden" name="redirect" value={redirectTo} />

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="text-sm font-medium">Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          name="email"
          type="email"
          required
          className="h-10 w-full rounded-md border px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
          placeholder="you@company.com"
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Password</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          name="password"
          type="password"
          required
          className="h-10 w-full rounded-md border px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
          placeholder="••••••••"
          autoComplete="current-password"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="h-10 w-full rounded-md bg-[#40E0D0] text-sm font-medium text-zinc-900 hover:bg-[#2CCFC0] disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Continue"}
      </button>
    </form>
  );
}
