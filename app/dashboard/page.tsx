import Link from "next/link";
import { getCurrentSchool } from "@/lib/school";
import { formatDateTime, LICENCE_LABELS, STATUS_LABELS } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/lib/types";
import { StatusBadge } from "./status-badge";

const TABS: { value: LeadStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  ...LEAD_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
];

export default async function LeadsPage({ searchParams }: PageProps<"/dashboard">) {
  const { status: statusParam } = await searchParams;
  const status = LEAD_STATUSES.find((s) => s === statusParam) ?? "all";

  const { supabase, school } = await getCurrentSchool();
  if (!school) return null; // the layout shows "create your school"

  // Row Level Security makes sure we only ever get this school's leads.
  let query = supabase
    .from("leads")
    .select("*")
    .eq("school_id", school.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (status !== "all") query = query.eq("status", status);

  const [{ data, error }, { count: newCount }] = await Promise.all([
    query,
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("school_id", school.id)
      .eq("status", "new"),
  ]);
  if (error) console.error("Loading leads failed:", error.message);
  const leads = (data ?? []) as Lead[];

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Leads</h1>
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-blue-700">{newCount ?? 0}</span> new
        </p>
      </div>

      {/* Status filter tabs (scroll sideways on small phones) */}
      <nav className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map((tab) => {
          const active = tab.value === status;
          return (
            <Link
              key={tab.value}
              href={tab.value === "all" ? "/dashboard" : `/dashboard?status=${tab.value}`}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset ${
                active ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200"
              }`}
            >
              {tab.label}
              {tab.value === "new" && (newCount ?? 0) > 0 ? ` (${newCount})` : ""}
            </Link>
          );
        })}
      </nav>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Could not load leads. Try again.</p>
      )}

      {!error && leads.length === 0 && (
        <div className="rounded-2xl bg-white p-8 text-center text-slate-600 ring-1 ring-slate-200">
          {status === "all"
            ? "No leads yet. When your AI assistant answers a call, the lead shows up here."
            : `No leads marked “${STATUS_LABELS[status]}”.`}
        </div>
      )}

      <ul className="space-y-3">
        {leads.map((lead) => (
          <li key={lead.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/dashboard/leads/${lead.id}`} className="min-w-0 flex-1">
                <p className="text-xs text-slate-500">{formatDateTime(lead.created_at)}</p>
                <p className="mt-0.5 truncate text-base font-semibold text-slate-900">
                  {lead.name || "Unknown caller"}
                  {lead.needs_owner && (
                    <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 align-middle text-xs font-semibold text-red-700">
                      ⚠️ Owner
                    </span>
                  )}
                </p>
                <p className="mt-1 truncate text-sm text-slate-600">
                  {LICENCE_LABELS[lead.licence_level]}
                  {lead.package_interest ? ` · ${lead.package_interest}` : ""}
                </p>
              </Link>
              <StatusBadge status={lead.status} />
            </div>
            <div className="mt-3 flex items-center gap-2">
              {lead.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
                >
                  📞 {formatPhone(lead.phone)}
                </a>
              )}
              <Link
                href={`/dashboard/leads/${lead.id}`}
                className="rounded-lg px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                Details →
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
