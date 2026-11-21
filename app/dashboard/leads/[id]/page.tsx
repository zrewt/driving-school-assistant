import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentSchool } from "@/lib/school";
import { formatDateTime, formatDuration, LICENCE_LABELS, STATUS_LABELS, STATUS_STYLES } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { LEAD_STATUSES, type Call, type Lead } from "@/lib/types";
import { StatusBadge } from "../../status-badge";
import { updateLeadStatus } from "./actions";

type LeadWithCall = Lead & { call: Call | null };

export default async function LeadPage({ params }: PageProps<"/dashboard/leads/[id]">) {
  const { id } = await params;
  const { supabase, school } = await getCurrentSchool();
  if (!school) return null;

  // Not a valid id → 404 (avoids a database error on bad links)
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data } = await supabase
    .from("leads")
    .select("*, call:calls(*)")
    .eq("id", id)
    .eq("school_id", school.id)
    .maybeSingle();
  if (!data) notFound();
  const lead = data as LeadWithCall;
  const call = lead.call;

  const details: [string, string | null][] = [
    ["Licence", LICENCE_LABELS[lead.licence_level]],
    ["Package", lead.package_interest],
    ["Preferred times", lead.preferred_times],
    ["Pickup area", lead.pickup_area],
    ["Questions", lead.questions_asked],
    ["Called from", call?.from_number ? formatPhone(call.from_number) : null],
    ["Call length", call?.duration_seconds != null ? formatDuration(call.duration_seconds) : null],
  ];

  return (
    <div className="space-y-4">
      <Link href="/dashboard" className="text-sm font-medium text-blue-700">
        ← All leads
      </Link>

      {/* Header */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">{formatDateTime(lead.created_at)}</p>
            <h1 className="mt-0.5 text-2xl font-bold">{lead.name || "Unknown caller"}</h1>
          </div>
          <StatusBadge status={lead.status} />
        </div>

        {lead.needs_owner && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            ⚠️ Needs the owner — complaint, refund or something unusual. Read the summary first.
          </p>
        )}

        {lead.phone && (
          <a
            href={`tel:${lead.phone}`}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-lg font-semibold text-white hover:bg-green-700"
          >
            📞 Call {formatPhone(lead.phone)}
          </a>
        )}

        {/* Status buttons */}
        <form action={updateLeadStatus} className="mt-4 grid grid-cols-2 gap-2">
          <input type="hidden" name="leadId" value={lead.id} />
          {LEAD_STATUSES.map((status) => {
            const active = lead.status === status;
            return (
              <button
                key={status}
                type="submit"
                name="status"
                value={status}
                aria-pressed={active}
                className={`rounded-lg px-3 py-2.5 text-sm font-semibold ring-1 ring-inset ${
                  active ? `${STATUS_STYLES[status]} ring-2` : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
                }`}
              >
                {active ? "✓ " : ""}
                {STATUS_LABELS[status]}
              </button>
            );
          })}
        </form>
      </section>

      {/* Lead details */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-3 font-semibold">Details</h2>
        <dl className="divide-y divide-slate-100">
          {details.map(([label, value]) => (
            <div key={label} className="flex gap-4 py-2 text-sm">
              <dt className="w-32 shrink-0 text-slate-500">{label}</dt>
              <dd className="min-w-0 flex-1 text-slate-900">{value || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Call summary + recording + transcript */}
      {call && (
        <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div>
            <h2 className="mb-2 font-semibold">Call summary</h2>
            <p className="text-sm text-slate-700">{call.summary || "No summary."}</p>
          </div>

          {call.recording_url && (
            <div>
              <h2 className="mb-2 font-semibold">Recording</h2>
              <audio controls preload="none" src={call.recording_url} className="w-full">
                <a href={call.recording_url}>Download recording</a>
              </audio>
            </div>
          )}

          <details>
            <summary className="cursor-pointer font-semibold">Transcript</summary>
            <div className="mt-3 space-y-2 text-sm">
              {(call.transcript || "No transcript.").split("\n").map((line, i) => {
                const isAgent = line.startsWith("Agent:");
                return (
                  <p key={i} className={isAgent ? "text-slate-500" : "text-slate-900"}>
                    {line}
                  </p>
                );
              })}
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
