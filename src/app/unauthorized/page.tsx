import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
        <div className="text-sm font-semibold uppercase tracking-wide text-red-600">Access denied</div>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">You do not have permission to view this page.</h1>
        <p className="mt-3 text-sm text-zinc-600">
          Your PulseKonnect role does not allow access to this area. If you believe this is a mistake,
          contact your organization administrator.
        </p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
