/**
 * Sends a realistic fake Retell "call_analyzed" webhook to your local app.
 *
 *   npm run test:webhook                  → a brand-new call (new lead + texts)
 *   npm run test:webhook -- --repeat      → sends the SAME call twice (tests no duplicates)
 *   npm run test:webhook -- --owner       → a complaint call that needs the owner
 *   npm run test:webhook -- --to +14165550100 --url http://localhost:3000
 *
 * If RETELL_WEBHOOK_SECRET (or RETELL_API_KEY) is set in .env.local, the
 * request is signed exactly the way Retell signs it.
 */
import { randomUUID } from "node:crypto";
import { signRetellPayload } from "../lib/retell-signature";

// Load .env.local if it exists (Node 20.12+ / 22+ built-in).
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local — fine
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

function isPlaceholder(value: string | undefined) {
  return !value || value.includes("your-") || value.startsWith("replace-with");
}

const baseUrl = arg("url") ?? process.env.APP_URL ?? "http://localhost:3000";
const toNumber = arg("to") ?? "+14165550100"; // Demo Driving School's AI number
const repeat = flag("repeat");
const ownerCall = flag("owner");
const key = !isPlaceholder(process.env.RETELL_WEBHOOK_SECRET)
  ? process.env.RETELL_WEBHOOK_SECRET!
  : !isPlaceholder(process.env.RETELL_API_KEY)
    ? process.env.RETELL_API_KEY!
    : null;

const now = Date.now();
const callId = `test_${randomUUID().replace(/-/g, "").slice(0, 20)}`;

const normalCall = {
  transcript: [
    "Agent: Hi, thanks for calling Demo Driving School! I'm the school's assistant. Just so you know, this call may be recorded. How can I help?",
    "User: Hi! I just got my G1 last week and I want to sign up for the full course.",
    "Agent: Congratulations! We have three BDE packages. Package 2 is $995 plus HST and includes the car for your G2 road test. Can I get your name?",
    "User: Priya Sharma.",
    "Agent: Thanks Priya. Is 416-555-0123 the best number to reach you?",
    "User: Yes.",
    "Agent: What days and times work best for lessons, and where should the instructor pick you up?",
    "User: Weekday evenings, near Bramalea City Centre. Do you do payment plans?",
    "Agent: Yes, packages can be split into 2 or 3 payments. Someone from the school will call you back shortly to book. Anything else?",
    "User: No, that's it. Thanks!",
  ].join("\n"),
  summary:
    "Priya just got her G1 and wants the BDE Full Course Package 2. She prefers weekday evenings with pickup near Bramalea City Centre and asked about payment plans.",
  data: {
    name: "Priya Sharma",
    phone: "416-555-0123",
    licence_level: "G1",
    package_interest: "BDE Full Course - Package 2",
    preferred_times: "Weekday evenings",
    pickup_area: "Bramalea City Centre",
    questions_asked: "Asked about payment plans",
    needs_owner: false,
  },
};

const complaintCall = {
  transcript: [
    "Agent: Hi, thanks for calling Demo Driving School! This call may be recorded. How can I help?",
    "User: My son's instructor didn't show up for his lesson today and I want a refund.",
    "Agent: I'm sorry about that. I'll pass this to the owner right away. Can I get your name?",
    "User: Angela Russo.",
    "Agent: Thank you Angela. The owner will call you back as soon as possible.",
  ].join("\n"),
  summary: "Angela Russo says her son's instructor didn't show up for today's lesson and wants a refund. Needs the owner.",
  data: {
    name: "Angela Russo",
    phone: "",
    licence_level: "unknown",
    package_interest: "",
    preferred_times: "",
    pickup_area: "",
    questions_asked: "Wants a refund for a missed lesson",
    needs_owner: true,
  },
};

const sample = ownerCall ? complaintCall : normalCall;

// Shape matches Retell's webhook: { event, call: { ...call object } }
const payload = {
  event: "call_analyzed",
  call: {
    call_type: "phone_call",
    call_id: callId,
    agent_id: "agent_test_123",
    call_status: "ended",
    direction: "inbound",
    from_number: "+14165550123",
    to_number: toNumber,
    start_timestamp: now - 150_000,
    end_timestamp: now - 8_000,
    duration_ms: 142_000,
    disconnection_reason: "user_hangup",
    transcript: sample.transcript,
    recording_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    call_analysis: {
      call_summary: sample.summary,
      in_voicemail: false,
      user_sentiment: ownerCall ? "Negative" : "Positive",
      call_successful: true,
      custom_analysis_data: sample.data,
    },
  },
};

async function send(label: string) {
  const rawBody = JSON.stringify(payload);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers["x-retell-signature"] = signRetellPayload(rawBody, key);

  const response = await fetch(`${baseUrl}/api/retell-webhook`, { method: "POST", headers, body: rawBody });
  const text = await response.text();
  console.log(`${label}: HTTP ${response.status}${text ? ` ${text}` : ""}`);
  return response.ok;
}

async function main() {
  console.log(`Sending call_analyzed for ${callId} to ${baseUrl}/api/retell-webhook`);
  console.log(key ? "Signing with your Retell key." : "No Retell key set — sending unsigned (works only with MOCK_SMS=true locally).");

  const ok = await send("First delivery");
  if (repeat) await send("Repeat delivery (should not create duplicates or texts)");

  console.log(ok ? "Done. Check the terminal running `npm run dev` for the logged texts." : "Request failed.");
  if (!ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Could not reach the app. Is `npm run dev` running?", error.message);
  process.exitCode = 1;
});
