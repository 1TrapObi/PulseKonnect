"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/db/supabase/browser";

export function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function onResend() {
    if (!email) return;
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/confirm`,
        },
      });
      if (resendError) throw resendError;
      setMessage("Verification email resent. Please check your inbox.");
    } catch (e: any) {
      setError(e?.message ?? "Failed to resend verification email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex min-h-screen max-w-md items-center px-6">
        <Card className="w-full shadow-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Check your email</CardTitle>
            <CardDescription>
              We sent a verification link to{" "}
              <span className="font-medium text-zinc-900">{email || "your email"}</span>.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-md border bg-white px-3 py-2 text-sm text-zinc-700">
              Click the link in the email to verify your account. Then you’ll be redirected back to continue.
            </div>

            {message ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                {message}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                {error}
              </div>
            ) : null}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onResend}
              disabled={loading || !email}
            >
              {loading ? "Sending…" : "Resend verification email"}
            </Button>

            <div className="text-center text-xs text-zinc-500">If you don’t see it, check your spam folder.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
