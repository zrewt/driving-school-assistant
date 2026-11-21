import { NextResponse, type NextRequest } from "next/server";
import { isMockSms, isServiceRoleConfigured, retellSigningKey } from "@/lib/config";
import { verifyRetellSignature } from "@/lib/retell-signature";
import { parseCall, parseLead, type RetellWebhookBody } from "@/lib/retell";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveCallAndLead } from "@/lib/save-call";

/**
 * POST /api/retell-webhook
 *
 * Retell calls this when a call starts, ends, and when its analysis is ready.
 * We only act on "call_analyzed" (it has the summary + extracted lead data).
 *
 * Retell waits up to 10 seconds for a 2xx and retries up to 3 times
 * otherwise, so we save quickly and reply.
 */
export async function POST(request: NextRequest) {
  // 1. Read the raw body. The signature is computed over these exact bytes,
  //    so we must verify BEFORE parsing the JSON.
  const rawBody = await request.text();
  const signature = request.headers.get("x-retell-signature");
  const key = retellSigningKey();

  if (key) {
    if (!verifyRetellSignature(rawBody, signature, key)) {
      console.warn("[retell-webhook] Rejected: invalid or missing signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else if (isMockSms() && process.env.NODE_ENV !== "production") {
    console.warn("[retell-webhook] No Retell key set — skipping signature check (local mock mode only)");
  } else {
    console.error("[retell-webhook] Rejected: RETELL_WEBHOOK_SECRET / RETELL_API_KEY is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 401 });
  }

  // 2. Parse the JSON.
  let body: RetellWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 3. Ignore everything except call_analyzed (reply 204 so Retell doesn't retry).
  if (body.event !== "call_analyzed" || !body.call?.call_id) {
    return new NextResponse(null, { status: 204 });
  }

  const call = parseCall(body.call);
  const lead = parseLead(body.call);
  console.log(`[retell-webhook] call_analyzed ${call.retell_call_id} from ${call.from_number} to ${call.to_number}`);

  if (!isServiceRoleConfigured()) {
    console.warn("[retell-webhook] Supabase is not configured — DRY RUN, nothing saved.");
    console.log("[retell-webhook] Parsed call:", { ...call, transcript: call.transcript?.slice(0, 80) + "…" });
    console.log("[retell-webhook] Parsed lead:", lead);
    return new NextResponse(null, { status: 204 });
  }

  // 4. Save the call + lead.
  try {
    const result = await saveCallAndLead(createAdminClient(), call, lead);

    if (result.outcome === "no_school") {
      // Nothing to retry: no school uses this number. Reply 2xx and log it.
      console.error(`[retell-webhook] No school has ai_phone_number = ${call.to_number}. Call not saved.`);
      return new NextResponse(null, { status: 204 });
    }

    console.log(
      `[retell-webhook] ${result.isNewCall ? "Saved new" : "Already had"} call ${call.retell_call_id} → lead ${result.lead.id} (${result.school.name})`,
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    // A database problem: log it and return 500 so Retell retries later.
    // Retries are safe because saving is idempotent.
    console.error("[retell-webhook] Failed to save call:", error);
    return NextResponse.json({ error: "Could not save call" }, { status: 500 });
  }
}
