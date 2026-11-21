// Turns a Retell webhook body into the rows we save.
// Field names come from the Retell docs (call object + call_analysis):
// https://docs.retellai.com/features/webhook-overview
// https://docs.retellai.com/api-references/get-call

import { toE164 } from "@/lib/phone";
import { LICENCE_LEVELS, type LicenceLevel } from "@/lib/types";

export interface RetellWebhookBody {
  event: string; // "call_started" | "call_ended" | "call_analyzed" | ...
  call?: RetellCall;
}

export interface RetellCall {
  call_id: string;
  call_type?: string; // "phone_call" | "web_call"
  from_number?: string;
  to_number?: string;
  direction?: string;
  start_timestamp?: number; // ms since epoch
  end_timestamp?: number;
  duration_ms?: number;
  transcript?: string;
  recording_url?: string;
  call_analysis?: {
    call_summary?: string;
    in_voicemail?: boolean;
    user_sentiment?: string;
    call_successful?: boolean;
    // Our post-call extraction fields (set up in the Retell dashboard)
    custom_analysis_data?: Record<string, unknown>;
  };
}

export interface ParsedCall {
  retell_call_id: string;
  from_number: string | null;
  to_number: string | null;
  started_at: string | null;
  duration_seconds: number | null;
  transcript: string | null;
  recording_url: string | null;
  summary: string | null;
}

export interface ParsedLead {
  name: string | null;
  phone: string | null;
  licence_level: LicenceLevel;
  package_interest: string | null;
  preferred_times: string | null;
  pickup_area: string | null;
  questions_asked: string | null;
  needs_owner: boolean;
}

/** Trimmed text, or null for empty / "unknown"-style answers. */
function text(value: unknown, maxLength = 500): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s || /^(n\/a|none|null|unknown|not provided|not mentioned)$/i.test(s)) return null;
  return s.slice(0, maxLength);
}

function bool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return /^(true|yes|y|1)$/i.test(value.trim());
  return value === 1;
}

/** "g1", "G-1", "has my G2" → "G1"/"G2"; "no licence" → "none"; else "unknown". */
export function normalizeLicence(value: unknown): LicenceLevel {
  if (value === null || value === undefined) return "unknown";
  const s = String(value).toUpperCase().replace(/[\s-]/g, "");
  if (s.includes("G1")) return "G1";
  if (s.includes("G2")) return "G2";
  if (/^(G|FULLG|FULL)$/.test(s) || s.includes("FULLG")) return "G";
  if (/^(NONE|NO|NOLICEN[CS]E|NOTYET)$/.test(s)) return "none";
  const exact = LICENCE_LEVELS.find((level) => level.toUpperCase() === s);
  return exact ?? "unknown";
}

export function parseCall(call: RetellCall): ParsedCall {
  let durationSeconds: number | null = null;
  if (typeof call.duration_ms === "number") durationSeconds = Math.round(call.duration_ms / 1000);
  else if (call.start_timestamp && call.end_timestamp) {
    durationSeconds = Math.round((call.end_timestamp - call.start_timestamp) / 1000);
  }

  return {
    retell_call_id: call.call_id,
    from_number: toE164(call.from_number) ?? text(call.from_number, 32),
    to_number: toE164(call.to_number) ?? text(call.to_number, 32),
    started_at: call.start_timestamp ? new Date(call.start_timestamp).toISOString() : null,
    duration_seconds: durationSeconds,
    transcript: text(call.transcript, 50_000),
    recording_url: text(call.recording_url, 2_000),
    summary: text(call.call_analysis?.call_summary, 2_000),
  };
}

export function parseLead(call: RetellCall): ParsedLead {
  const data = call.call_analysis?.custom_analysis_data ?? {};
  return {
    name: text(data.name, 120),
    // If the caller didn't give a number, use the number they called from.
    phone: toE164(text(data.phone, 40)) ?? toE164(call.from_number),
    licence_level: normalizeLicence(data.licence_level),
    package_interest: text(data.package_interest, 200),
    preferred_times: text(data.preferred_times, 200),
    pickup_area: text(data.pickup_area, 200),
    questions_asked: text(data.questions_asked, 1_000),
    needs_owner: bool(data.needs_owner),
  };
}
