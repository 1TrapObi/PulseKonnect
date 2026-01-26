import Link from "next/link";
import { signUp } from "@/app/(auth)/actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex min-h-screen max-w-md items-center px-6">
        <div className="w-full rounded-2xl border bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight">Create account</h1>
            <p className="text-sm text-zinc-600">
              Start capturing leads and recruiting candidates.
            </p>
          </div>

          {error ? (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
              {error}
            </div>
          ) : null}

          <form action={signUp} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <input
                name="email"
                type="email"
                required
                className="h-10 w-full rounded-md border px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                placeholder="you@company.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <input
                name="password"
                type="password"
                required
                className="h-10 w-full rounded-md border px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                placeholder="Create a password"
              />
            </div>

            <button className="h-10 w-full rounded-md bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800">
              Create account
            </button>
          </form>

          <p className="mt-6 text-sm text-zinc-600">
            Already have an account?{" "}
            <Link className="font-medium text-zinc-900" href="/login">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
