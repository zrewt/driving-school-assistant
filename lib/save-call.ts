import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedCall, ParsedLead } from "@/lib/retell";
import type { Lead, School } from "@/lib/types";

export type SaveResult =
  | { outcome: "no_school" }
  | { outcome: "saved"; school: School; lead: Lead; isNewCall: boolean };

/**
 * Saves one analyzed call and its lead. Safe to run many times for the same
 * Retell call (Retell retries webhooks): the unique retell_call_id on calls
 * and the unique call_id on leads mean we never create duplicates.
 *
 * Uses the service-role client (bypasses RLS) — server only.
 */
export async function saveCallAndLead(
  db: SupabaseClient,
  call: ParsedCall,
  lead: ParsedLead,
): Promise<SaveResult> {
  // 1. Which school owns the number that was called?
  if (!call.to_number) return { outcome: "no_school" };
  const { data: school, error: schoolError } = await db
    .from("schools")
    .select("*")
    .eq("ai_phone_number", call.to_number)
    .maybeSingle<School>();
  if (schoolError) throw new Error(`School lookup failed: ${schoolError.message}`);
  if (!school) return { outcome: "no_school" };

  // 2. Save the call. If this retell_call_id already exists, do nothing.
  const { data: inserted, error: insertCallError } = await db
    .from("calls")
    .upsert({ ...call, school_id: school.id }, { onConflict: "retell_call_id", ignoreDuplicates: true })
    .select("id");
  if (insertCallError) throw new Error(`Saving call failed: ${insertCallError.message}`);
  const isNewCall = (inserted?.length ?? 0) > 0;

  const { data: savedCall, error: callError } = await db
    .from("calls")
    .select("id")
    .eq("retell_call_id", call.retell_call_id)
    .single<{ id: string }>();
  if (callError) throw new Error(`Loading call failed: ${callError.message}`);

  // 3. Save the lead for this call. One lead per call (unique call_id).
  const { error: insertLeadError } = await db
    .from("leads")
    .upsert({ ...lead, school_id: school.id, call_id: savedCall.id }, { onConflict: "call_id", ignoreDuplicates: true });
  if (insertLeadError) throw new Error(`Saving lead failed: ${insertLeadError.message}`);

  const { data: savedLead, error: leadError } = await db
    .from("leads")
    .select("*")
    .eq("call_id", savedCall.id)
    .single<Lead>();
  if (leadError) throw new Error(`Loading lead failed: ${leadError.message}`);

  return { outcome: "saved", school, lead: savedLead, isNewCall };
}
