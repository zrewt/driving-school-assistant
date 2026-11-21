import "server-only";
import twilio from "twilio";
import { isMockSms, isPlaceholder } from "@/lib/config";

export const MAX_SMS_LENGTH = 320;

export type SmsResult = { ok: true; mocked: boolean; sid?: string } | { ok: false; error: string };

/** Shortens a message to fit our 320-character limit. */
export function fitSms(body: string): string {
  const chars = Array.from(body); // counts emoji as one character
  if (chars.length <= MAX_SMS_LENGTH) return body;
  return chars.slice(0, MAX_SMS_LENGTH - 1).join("") + "…";
}

/**
 * Sends one text message.
 * - MOCK_SMS=true → prints it to the terminal instead (nothing is sent).
 * - Otherwise → sends it through Twilio.
 * Never throws: failures come back as { ok: false } and are logged.
 */
export async function sendSms(to: string | null | undefined, body: string): Promise<SmsResult> {
  const message = fitSms(body);

  if (!to) {
    console.warn("[sms] Skipped: no phone number");
    return { ok: false, error: "No phone number" };
  }

  if (isMockSms()) {
    console.log(
      [
        "",
        "┌──────────── 📱 MOCK SMS (not sent) ────────────",
        `│ To:   ${to}`,
        `│ From: ${process.env.TWILIO_FROM_NUMBER || "(TWILIO_FROM_NUMBER not set)"}`,
        `│ (${Array.from(message).length} chars)`,
        ...message.split("\n").map((line) => `│ ${line}`),
        "└────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return { ok: true, mocked: true };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (isPlaceholder(sid) || isPlaceholder(token) || isPlaceholder(from)) {
    console.error("[sms] Twilio is not configured (TWILIO_* env vars). Set MOCK_SMS=true to test without it.");
    return { ok: false, error: "Twilio not configured" };
  }

  try {
    const client = twilio(sid, token);
    const sent = await client.messages.create({ to, from, body: message });
    console.log(`[sms] Sent ${sent.sid} to ${to}`);
    return { ok: true, mocked: false, sid: sent.sid };
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    console.error(`[sms] Failed to send to ${to}: ${text}`);
    return { ok: false, error: text };
  }
}
