import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { isPlaceholder, isServiceRoleConfigured } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { averagePackagePrice, getWeekStats, torontoParts, weekRanges } from "@/lib/stats";
import { sendSms } from "@/lib/sms";
import { weeklyReportText } from "@/lib/messages";
import type { Package } from "@/lib/types";

export const maxDuration = 60;

/** Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". */
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (isPlaceholder(secret)) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * GET /api/cron/weekly-report
 *
 * Texts each school owner last week's numbers. vercel.json runs this at
 * 13:00 and 14:00 UTC on Mondays; only the run that lands at 9 a.m. Toronto
 * time sends texts (that's 13:00 UTC in summer, 14:00 UTC in winter).
 * Add ?force=1 to send right now (for testing).
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = request.nextUrl.searchParams.get("force") === "1";
  const now = new Date();
  const toronto = torontoParts(now);
  if (!force && !(toronto.weekday === 0 && toronto.hour === 9)) {
    return NextResponse.json({ skipped: true, reason: "Not Monday 9 a.m. in Toronto (add ?force=1 to send now)" });
  }

  if (!isServiceRoleConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const db = createAdminClient();
  const { lastWeek } = weekRanges(now);

  const { data: schools, error } = await db
    .from("schools")
    .select("id, name, owner_phone, school_info(packages)");
  if (error) {
    console.error("[weekly-report] Loading schools failed:", error.message);
    return NextResponse.json({ error: "Could not load schools" }, { status: 500 });
  }

  const results: { school: string; sent: boolean; reason?: string }[] = [];

  for (const school of schools ?? []) {
    try {
      if (!school.owner_phone) {
        results.push({ school: school.name, sent: false, reason: "no owner_phone" });
        continue;
      }
      // school_info comes back as an object (one-to-one) or array depending on the relation
      const info = Array.isArray(school.school_info) ? school.school_info[0] : school.school_info;
      const avgPrice = averagePackagePrice((info as { packages?: Package[] } | null)?.packages);

      const stats = await getWeekStats(db, school.id, lastWeek, avgPrice);
      const result = await sendSms(
        school.owner_phone,
        weeklyReportText(stats.calls, stats.leads, stats.booked, stats.revenue),
      );
      results.push({ school: school.name, sent: result.ok, reason: result.ok ? undefined : result.error });
    } catch (err) {
      // One school failing must not stop the others.
      console.error(`[weekly-report] ${school.name} failed:`, err);
      results.push({ school: school.name, sent: false, reason: "error" });
    }
  }

  console.log("[weekly-report] Done:", results);
  return NextResponse.json({ week: lastWeek, results });
}
