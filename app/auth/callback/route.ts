import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The link in Supabase's confirmation email lands here with a one-time
// ?code=... which we swap for a login session.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/dashboard", request.url));
    console.error("Auth callback failed:", error.message);
  }
  return NextResponse.redirect(new URL("/login", request.url));
}
