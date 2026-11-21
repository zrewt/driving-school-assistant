import { getCurrentSchool } from "@/lib/school";
import { averagePackagePrice, getWeekStats, weekRanges, type WeekStats } from "@/lib/stats";
import { formatMoney, TIMEZONE } from "@/lib/format";
import type { SchoolInfo } from "@/lib/types";

function shortDate(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, month: "short", day: "numeric" }).format(d);
}

export default async function StatsPage() {
  const { supabase, school } = await getCurrentSchool();
  if (!school) return null;

  const { data: info } = await supabase.from("school_info").select("packages").eq("school_id", school.id).maybeSingle();
  const avgPrice = averagePackagePrice((info as Pick<SchoolInfo, "packages"> | null)?.packages);
  const { thisWeek, lastWeek } = weekRanges();

  let current: WeekStats, previous: WeekStats;
  try {
    [current, previous] = await Promise.all([
      getWeekStats(supabase, school.id, thisWeek, avgPrice),
      getWeekStats(supabase, school.id, lastWeek, avgPrice),
    ]);
  } catch (error) {
    console.error(error);
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Could not load stats. Try again.</p>;
  }

  const rows: { label: string; key: keyof WeekStats; money?: boolean }[] = [
    { label: "Calls answered", key: "calls" },
    { label: "Leads", key: "leads" },
    { label: "Booked", key: "booked" },
    { label: "Est. revenue", key: "revenue", money: true },
  ];

  const lastWeekEnd = new Date(lastWeek.end.getTime() - 1);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Stats</h1>
      <p className="mb-6 text-sm text-slate-600">
        This week ({shortDate(thisWeek.start)} – today) vs last week ({shortDate(lastWeek.start)} – {shortDate(lastWeekEnd)}).
      </p>

      <div className="grid grid-cols-2 gap-3">
        {rows.map(({ label, key, money }) => {
          const now = current[key];
          const before = previous[key];
          const diff = now - before;
          const show = (n: number) => (money ? formatMoney(n) : n.toLocaleString("en-CA"));
          return (
            <div key={key} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-1 text-3xl font-bold">{show(now)}</p>
              <p className="mt-1 text-xs text-slate-500">
                Last week: {show(before)}{" "}
                {diff !== 0 && (
                  <span className={diff > 0 ? "font-semibold text-green-700" : "font-semibold text-red-600"}>
                    ({diff > 0 ? "▲" : "▼"} {show(Math.abs(diff))})
                  </span>
                )}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-slate-500">
        “Booked” counts leads from that week that are now marked Booked. Est. revenue = booked leads ×{" "}
        {avgPrice > 0 ? `your average package price (${formatMoney(avgPrice)})` : "your average package price (add packages in Settings)"}
        , before HST. The owner gets last week&apos;s numbers by text every Monday at 9 a.m.
      </p>
    </div>
  );
}
