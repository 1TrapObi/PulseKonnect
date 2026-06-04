import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

type Role = "super_admin" | "admin" | "staff";

const routeRoles: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: "/admin/billing", roles: ["super_admin"] },
  { prefix: "/admin/settings", roles: ["super_admin", "admin"] },
  { prefix: "/admin/users", roles: ["super_admin", "admin"] },
  { prefix: "/admin/analytics", roles: ["super_admin", "admin"] },
  { prefix: "/admin/leads", roles: ["super_admin", "admin", "staff"] },
  { prefix: "/settings", roles: ["super_admin", "admin"] },
  { prefix: "/analytics", roles: ["super_admin", "admin"] },
  { prefix: "/leads/configuration", roles: ["super_admin", "admin"] },
];

function normalizeRole(role: string | null | undefined): Role {
  if (role === "super_admin" || role === "admin" || role === "staff") return role;
  return "admin";
}

function allowedRolesForPath(pathname: string): Role[] | null {
  const match = routeRoles.find((route) => pathname === route.prefix || pathname.startsWith(route.prefix + "/"));
  return match?.roles ?? null;
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const inDashboardGroup = request.nextUrl.pathname.startsWith("/leads") ||
    request.nextUrl.pathname.startsWith("/candidates") ||
    request.nextUrl.pathname.startsWith("/analytics") ||
    request.nextUrl.pathname.startsWith("/settings") ||
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/onboarding") ||
    request.nextUrl.pathname === "/dashboard";

  if (inDashboardGroup && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (inDashboardGroup && user && !user.email_confirmed_at) {
    const url = request.nextUrl.clone();
    url.pathname = "/verify-email";
    url.searchParams.set("email", user.email ?? "");
    return NextResponse.redirect(url);
  }

  const requiredRoles = allowedRolesForPath(request.nextUrl.pathname);
  if (inDashboardGroup && user && requiredRoles) {
    const admin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // noop
          },
        },
      }
    );
    const { data: userRow } = await admin
      .from("users")
      .select("role,status")
      .eq("id", user.id)
      .maybeSingle<{ role: string | null; status: string | null }>();
    const role = normalizeRole(userRow?.role);
    if (userRow?.status === "deactivated" || !requiredRoles.includes(role)) {
      const url = request.nextUrl.clone();
      url.pathname = "/unauthorized";
      url.searchParams.set("from", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  }

  if ((request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup") && user) {
    const url = request.nextUrl.clone();
    url.pathname = user.email_confirmed_at ? "/dashboard" : "/verify-email";
    if (!user.email_confirmed_at) url.searchParams.set("email", user.email ?? "");
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/leads/:path*",
    "/candidates/:path*",
    "/analytics/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/unauthorized",
    "/onboarding/:path*",
    "/login",
    "/signup",
  ],
};
