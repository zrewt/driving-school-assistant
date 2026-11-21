// The wording of every text message we send, in one place.

import { formatPhone } from "@/lib/phone";
import type { Lead } from "@/lib/types";

/** "Priya Sharma" → "Priya S." (keeps texts short and a bit more private). */
export function shortName(name: string | null): string {
  if (!name) return "Unknown caller";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

function sentence(value: string | null): string {
  if (!value) return "";
  const trimmed = value.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * Text to the school admin, e.g.
 * 📞 New lead: Priya S., 416-555-0123. G1 → BDE Full Course - Package 2.
 * Weekday evenings, near Bramalea. Asked about payment plans.
 */
export function adminLeadText(lead: Lead, appUrl?: string): string {
  const lines: string[] = [];
  lines.push(`📞 New lead: ${shortName(lead.name)}${lead.phone ? `, ${formatPhone(lead.phone)}` : ""}.`);

  const licence = lead.licence_level !== "unknown" ? lead.licence_level : null;
  if (licence && lead.package_interest) lines.push(`${licence} → ${lead.package_interest}.`);
  else if (licence) lines.push(`Licence: ${licence}.`);
  else if (lead.package_interest) lines.push(`Wants: ${lead.package_interest}.`);

  const when = [lead.preferred_times, lead.pickup_area ? `near ${lead.pickup_area}` : null]
    .filter(Boolean)
    .join(", ");
  if (when) lines.push(sentence(when));
  if (lead.questions_asked) lines.push(sentence(lead.questions_asked));

  // The "needs owner" flag must never be cut off, so we shorten the
  // details first if the text would go over the limit.
  const flag = lead.needs_owner ? "\n⚠️ Needs owner" : "";
  const link = appUrl ? `\n${appUrl.replace(/\/$/, "")}/dashboard/leads/${lead.id}` : "";
  let details = lines.join(" ");

  const room = MAX_SMS_LENGTH - length(flag);
  if (length(details) > room) details = Array.from(details).slice(0, room - 1).join("") + "…";

  // Only add the dashboard link if it still fits.
  const withLink = details + flag + link;
  return length(withLink) <= MAX_SMS_LENGTH ? withLink : details + flag;
}

const MAX_SMS_LENGTH = 320;
const length = (s: string) => Array.from(s).length; // counts an emoji as 1

/** Confirmation text to the person who called. */
export function callerConfirmationText(schoolName: string, needsOwner: boolean): string {
  if (needsOwner) {
    return `Thanks for calling ${schoolName}! We got your message and someone from our team will call you back shortly.`;
  }
  return `Thanks for calling ${schoolName}! We'll reach out shortly to book your lesson.`;
}

/** Monday-morning report to the owner. */
export function weeklyReportText(calls: number, leads: number, booked: number, revenue: number): string {
  const money = revenue.toLocaleString("en-CA", { maximumFractionDigits: 0 });
  return `Last week your assistant answered ${calls} call${calls === 1 ? "" : "s"}, got ${leads} lead${leads === 1 ? "" : "s"}, and you booked ${booked}. Est. $${money} in lessons.`;
}
