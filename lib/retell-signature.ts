import { createHmac, timingSafeEqual } from "node:crypto";

// Retell signs every webhook with the header:
//   x-retell-signature: v=<timestamp in ms>,d=<hex digest>
// where digest = HMAC-SHA256(rawBody + timestamp, key) and the key is your
// Retell API key that has the "webhook" badge.
// Docs: https://docs.retellai.com/features/secure-webhook

const MAX_AGE_MS = 5 * 60 * 1000; // reject signatures older than 5 minutes

function digest(rawBody: string, timestamp: string, key: string): string {
  return createHmac("sha256", key).update(rawBody + timestamp).digest("hex");
}

/** Returns true only if the signature matches this exact body and is recent. */
export function verifyRetellSignature(
  rawBody: string,
  signature: string | null,
  key: string,
  now: number = Date.now(),
): boolean {
  if (!signature) return false;
  const match = /^v=(\d+),d=([0-9a-fA-F]+)$/.exec(signature.trim());
  if (!match) return false;

  const [, timestamp, received] = match;
  if (Math.abs(now - Number(timestamp)) > MAX_AGE_MS) return false;

  const expected = Buffer.from(digest(rawBody, timestamp, key), "hex");
  const given = Buffer.from(received, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Creates a valid signature. Used by scripts/send-test-webhook.ts. */
export function signRetellPayload(rawBody: string, key: string, now: number = Date.now()): string {
  const timestamp = String(now);
  return `v=${timestamp},d=${digest(rawBody, timestamp, key)}`;
}
