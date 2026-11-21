import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/config";

/**
 * Runs before every page request (see proxy.ts):
 * 1. refreshes the Supabase session cookie if needed, and
 * 2. sends logged-out visitors on /dashboard to /login.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");

  if (!isSupabaseConfigured()) {
    // No real Supabase keys yet: nobody can be logged in.
    if (isDashboard) return redirectToLogin(request);
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // getClaims() validates the session token. Don't put code between
  // createServerClient and this call.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);

  if (isDashboard && !isLoggedIn) return redirectToLogin(request);

  if (request.nextUrl.pathname === "/login" && isLoggedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}
