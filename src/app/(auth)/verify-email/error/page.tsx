"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function VerifyEmailErrorPage() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message") ?? "Verification failed.";

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex min-h-screen max-w-md items-center px-6">
        <Card className="w-full shadow-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Verification failed</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <Button asChild className="w-full">
              <Link href="/signup">Try signing up again</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
