import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSms } from "@/lib/sms";
import { adminLeadText, callerConfirmationText } from "@/lib/messages";
import { isPlaceholder } from "@/lib/config";
import type { Lead, School } from "@/lib/types";

type NotifiedColumn = "admin_notified_at" | "caller_notified_at";

/**
 * "Claims" the right to send one text by stamping the time on the lead,
 * but only if nobody has stamped it yet. If two webhook deliveries arrive
 * at once, only one of them wins the claim, so texts are never doubled.
 */
async function claim(db: SupabaseClient, leadId: string, column: NotifiedColumn): Promise<boolean> {
  const { data, error } = await db
    .from("leads")
    .update({ [column]: new Date().toISOString() })
    .eq("id", leadId)
    .is(column, null)
    .select("id");
  if (error) {
    console.error(`[notify] Could not claim ${column} for lead ${leadId}: ${error.message}`);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

/** If the text failed, remove the stamp so we know it never went out. */
async function release(db: SupabaseClient, leadId: string, column: NotifiedColumn) {
  await db.from("leads").update({ [column]: null }).eq("id", leadId);
}

/**
 * Sends the two texts for a new lead: a summary to the school admin and a
 * confirmation to the caller. Each is sent at most once per lead.
 * Never throws — text problems are logged and must not break the webhook.
 */
export async function notifyNewLead(db: SupabaseClient, school: School, lead: Lead): Promise<void> {
  try {
    const appUrl = isPlaceholder(process.env.APP_URL) ? undefined : process.env.APP_URL;

    if (!school.admin_phone) {
      console.warn(`[notify] ${school.name} has no admin_phone — admin text skipped`);
    } else if (await claim(db, lead.id, "admin_notified_at")) {
      const result = await sendSms(school.admin_phone, adminLeadText(lead, appUrl));
      if (!result.ok) await release(db, lead.id, "admin_notified_at");
    }

    if (!lead.phone) {
      console.warn(`[notify] Lead ${lead.id} has no phone — caller confirmation skipped`);
    } else if (await claim(db, lead.id, "caller_notified_at")) {
      const result = await sendSms(lead.phone, callerConfirmationText(school.name, lead.needs_owner));
      if (!result.ok) await release(db, lead.id, "caller_notified_at");
    }
  } catch (error) {
    console.error("[notify] Unexpected error while texting:", error);
  }
}
