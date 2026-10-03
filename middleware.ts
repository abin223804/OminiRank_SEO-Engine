import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_EXACT_PATHS = new Set([
  "/login",
  "/free-audit",
  "/auth/callback",
  "/auth/confirm",
  "/favicon.ico",
]);

const PUBLIC_PATH_PREFIXES = [
  "/_next",
  "/api/v1/billing/webhook",
  "/api/v1/auth",
  "/api/v1/free-audit",   // lead magnet — no auth required
  "/api/v1/workspaces/invitations",
  "/api/v1/cron",
  "/api/v1/jobs",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow public static assets and auth callback routes unconditionally
  if (
    PUBLIC_EXACT_PATHS.has(pathname) ||
    PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return NextResponse.next();
  }

  // 2. If Supabase credentials are not configured, allow dev bypass
  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  if (!isSupabaseConfigured) {
    return NextResponse.next();
  }

  // 3. Update/refresh Supabase session cookie
  const { response, user } = await updateSession(request);

  // 4. If user is authenticated, permit entry
  if (user) {
    return response;
  }

  // 5. Unauthenticated handler
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Unauthorized: Active authentication session required" },
      { status: 401 }
    );
  }

  // Redirect web browser to login page
  const redirectUrl = new URL("/login", request.url);
  redirectUrl.searchParams.set("redirectTo", pathname);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions (.svg, .png, .jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
