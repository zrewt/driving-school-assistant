// Weekly numbers for the Stats page and the Monday SMS report.
// Weeks run Monday 00:00 → next Monday 00:00, Toronto time.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Package } from "@/lib/types";

const TZ = "America/Toronto";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Toronto's offset from UTC at a moment, in minutes (e.g. -300 in winter, -240 in summer). */
function torontoOffsetMinutes(at: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value; // "GMT-05:00"
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name ?? "");
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/** The year/month/day/weekday/hour it is in Toronto at a moment. */
export function torontoParts(at: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
      hour: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    weekday: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday), // 0 = Monday
  };
}

/** The UTC moment of midnight in Toronto on a given calendar date. */
function torontoMidnight(year: number, month: number, day: number): Date {
  const guess = Date.UTC(year, month - 1, day);
  let result = guess - torontoOffsetMinutes(new Date(guess)) * 60_000;
  // Re-check in case daylight saving changed between the guess and the result.
  result = guess - torontoOffsetMinutes(new Date(result)) * 60_000;
  return new Date(result);
}

export interface WeekRange {
  start: Date; // inclusive
  end: Date; // exclusive
}

/** This week (Monday 00:00 Toronto → next Monday) and the week before it. */
export function weekRanges(now: Date = new Date()): { thisWeek: WeekRange; lastWeek: WeekRange } {
  const t = torontoParts(now);
  // Calendar date of this week's Monday (date math in UTC is safe for whole days)
  const monday = new Date(Date.UTC(t.year, t.month - 1, t.day) - t.weekday * DAY_MS);
  const at = (offsetDays: number) => {
    const d = new Date(monday.getTime() + offsetDays * DAY_MS);
    return torontoMidnight(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  };
  return {
    thisWeek: { start: at(0), end: at(7) },
    lastWeek: { start: at(-7), end: at(0) },
  };
}

/** Average package price, used to estimate revenue. 0 if no packages. */
export function averagePackagePrice(packages: Package[] | null | undefined): number {
  const prices = (packages ?? []).map((p) => Number(p.price)).filter((n) => Number.isFinite(n) && n > 0);
  if (prices.length === 0) return 0;
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}

export interface WeekStats {
  calls: number;
  leads: number;
  booked: number;
  revenue: number;
}

/**
 * Counts for one school and one week.
 * - calls: calls the assistant answered that week
 * - leads: leads created that week
 * - booked: of those leads, how many are now marked "Booked"
 * - revenue: booked × average package price (a rough estimate)
 */
export async function getWeekStats(
  db: SupabaseClient,
  schoolId: string,
  range: WeekRange,
  avgPrice: number,
): Promise<WeekStats> {
  const from = range.start.toISOString();
  const to = range.end.toISOString();

  const count = async (table: "calls" | "leads", status?: string) => {
    let query = db
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .gte("created_at", from)
      .lt("created_at", to);
    if (status) query = query.eq("status", status);
    const { count, error } = await query;
    if (error) throw new Error(`Counting ${table} failed: ${error.message}`);
    return count ?? 0;
  };

  const [calls, leads, booked] = await Promise.all([count("calls"), count("leads"), count("leads", "booked")]);
  return { calls, leads, booked, revenue: Math.round(booked * avgPrice) };
}
