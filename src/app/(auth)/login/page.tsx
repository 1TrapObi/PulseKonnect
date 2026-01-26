import Link from "next/link";
import Image from "next/image";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const redirectTo = sp.redirect ?? "/dashboard";
  const error = sp.error;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex min-h-screen max-w-md items-center px-6">
        <div className="w-full rounded-2xl border bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <div className="flex justify-center">
              <Image
                src="/pulsekonnect-logo.svg"
                alt="Pulse Konnect"
                width={220}
                height={64}
                className="h-auto w-[220px]"
                priority
              />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-sm text-zinc-600">
              Access your Pulse Konnect dashboard.
            </p>
          </div>

          <LoginForm redirectTo={redirectTo} initialError={error} />

          <p className="mt-6 text-sm text-zinc-600">
            Don&apos;t have an account?{" "}
            <Link className="font-medium text-zinc-900" href="/signup">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
