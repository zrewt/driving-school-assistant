import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 calls this file "proxy" (it used to be "middleware").
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Only run on pages that care about login. API routes (the Retell webhook
  // and cron job) do their own checks and are skipped here.
  matcher: ["/dashboard/:path*", "/login"],
};
