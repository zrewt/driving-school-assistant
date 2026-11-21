import "server-only";
import twilio from "twilio";
import { isMockSms, isPlaceholder } from "@/lib/config";

export const MAX_SMS_LENGTH = 320;

export type SmsResult = { ok: true; mocked: boolean; sid?: string } | { ok: false; error: string };

/** Which company sends our texts: SMS_PROVIDER=telnyx or twilio (default twilio). */
export function smsProvider(): "telnyx" | "twilio" {
  return process.env.SMS_PROVIDER?.trim().toLowerCase() === "telnyx" ? "telnyx" : "twilio";
}

function fromNumber(): string | undefined {
  return smsProvider() === "telnyx" ? process.env.TELNYX_FROM_NUMBER : process.env.TWILIO_FROM_NUMBER;
}

/** Shortens a message to fit our 320-character limit. */
export function fitSms(body: string): string {
  const chars = Array.from(body); // counts emoji as one character
  if (chars.length <= MAX_SMS_LENGTH) return body;
  return chars.slice(0, MAX_SMS_LENGTH - 1).join("") + "…";
}

/**
 * Sends one text message.
 * - MOCK_SMS=true → prints it to the terminal instead (nothing is sent).
 * - Otherwise → sends it through Telnyx or Twilio (see SMS_PROVIDER).
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
        `│ From: ${fromNumber() || "(from number not set)"} via ${smsProvider()}`,
        `│ (${Array.from(message).length} chars)`,
        ...message.split("\n").map((line) => `│ ${line}`),
        "└────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return { ok: true, mocked: true };
  }

  return smsProvider() === "telnyx" ? sendWithTelnyx(to, message) : sendWithTwilio(to, message);
}

// ---------------------------------------------------------------------
// Telnyx: POST https://api.telnyx.com/v2/messages  { from, to, text }
// Docs: https://developers.telnyx.com/docs/messaging/messages/send-message
// ---------------------------------------------------------------------
async function sendWithTelnyx(to: string, text: string): Promise<SmsResult> {
  const apiKey = process.env.TELNYX_API_KEY;
  const from = process.env.TELNYX_FROM_NUMBER;
  if (isPlaceholder(apiKey) || isPlaceholder(from)) {
    console.error("[sms] Telnyx is not configured (TELNYX_API_KEY / TELNYX_FROM_NUMBER). Set MOCK_SMS=true to test without it.");
    return { ok: false, error: "Telnyx not configured" };
  }

  try {
    const response = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to, text }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await response.json().catch(() => ({}))) as {
      data?: { id?: string };
      errors?: { code?: string; title?: string; detail?: string }[];
    };

    if (!response.ok) {
      const e = json.errors?.[0];
      const detail = e ? `${e.title ?? "Error"}${e.detail ? `: ${e.detail}` : ""} (code ${e.code ?? "?"})` : "";
      const error = `HTTP ${response.status} ${detail}`.trim();
      console.error(`[sms] Telnyx failed to send to ${to}: ${error}`);
      return { ok: false, error };
    }

    console.log(`[sms] Sent ${json.data?.id ?? "(no id)"} to ${to} via Telnyx`);
    return { ok: true, mocked: false, sid: json.data?.id };
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    console.error(`[sms] Telnyx request to ${to} failed: ${text}`);
    return { ok: false, error: text };
  }
}

// ---------------------------------------------------------------------
// Twilio
// ---------------------------------------------------------------------
async function sendWithTwilio(to: string, body: string): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (isPlaceholder(sid) || isPlaceholder(token) || isPlaceholder(from)) {
    console.error("[sms] Twilio is not configured (TWILIO_* env vars). Set MOCK_SMS=true to test without it.");
    return { ok: false, error: "Twilio not configured" };
  }

  try {
    const client = twilio(sid, token);
    const sent = await client.messages.create({ to, from, body });
    console.log(`[sms] Sent ${sent.sid} to ${to} via Twilio`);
    return { ok: true, mocked: false, sid: sent.sid };
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    console.error(`[sms] Twilio failed to send to ${to}: ${text}`);
    return { ok: false, error: text };
  }
}
