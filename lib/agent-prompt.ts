// Builds the Retell agent prompt from a school's saved info.
// Paste the result into your Retell agent's prompt box.

import { DAY_KEYS, DAY_LABELS, type BusinessHours, type Faq, type Package } from "@/lib/types";

export interface PromptInput {
  schoolName: string;
  businessHours: BusinessHours;
  packages: Package[];
  faqs: Faq[];
  extraNotes: string | null;
}

/** "09:00" → "9:00 a.m." */
function time12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  const suffix = h >= 12 ? "p.m." : "a.m.";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m || 0).padStart(2, "0")} ${suffix}`;
}

export function formatHours(hours: BusinessHours): string {
  return DAY_KEYS.map((day) => {
    const d = hours[day];
    if (!d || d.closed) return `- ${DAY_LABELS[day]}: closed`;
    return `- ${DAY_LABELS[day]}: ${time12(d.open)} to ${time12(d.close)}`;
  }).join("\n");
}

function formatPrice(price: number): string {
  return `$${price.toLocaleString("en-CA", { maximumFractionDigits: 2 })}`;
}

export function buildAgentPrompt(input: PromptInput): string {
  const school = input.schoolName.trim() || "the driving school";

  const packages = input.packages.length
    ? input.packages
        .map((p) => `- ${p.name}: ${formatPrice(p.price)} plus HST.${p.details ? ` ${p.details}` : ""}`)
        .join("\n")
    : "- (No packages have been added yet. Do not quote any prices.)";

  const faqs = input.faqs.length
    ? input.faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")
    : "(No FAQs have been added yet.)";

  return `# Role
You are the friendly phone assistant for ${school}, a driving school in Ontario, Canada. You answer calls the office could not pick up. Your job is to answer simple questions using ONLY the school information below, collect the caller's details, and let them know someone from the school will call them back to book.

# Start of every call
Greet the caller warmly as ${school}'s assistant, and tell them the call may be recorded. For example:
"Hi, thanks for calling ${school}! I'm the school's assistant. Just so you know, this call may be recorded. How can I help you today?"

# Style
- Be warm, brief and natural, like a friendly receptionist. Use short sentences.
- Ask one question at a time. Don't read long lists; mention the one or two most relevant options.
- Many callers are teenagers or their parents. Be patient and plain-spoken.
- Say prices as "seven hundred forty-five dollars plus HST".

# Strict rules
- Answer ONLY from the school information below. Never make up prices, packages, discounts, availability, policies, instructor names or dates.
- If you don't know an answer, say: "Good question. I'll make sure someone from the school answers that when they call you back." and note the question.
- You cannot book lessons, take payments or confirm times. Someone from the school will call back to book.
- Do not ask for licence numbers, dates of birth, full home addresses, or any payment details. If the caller offers them, politely say you don't need them.

# Information to collect (naturally, during the conversation)
1. Their name
2. The best phone number to call them back (confirm the number they're calling from is OK)
3. Their licence level: G1, G2, full G, or no licence yet
4. Which package or service they're interested in
5. Preferred lesson days and times
6. Pickup area (a neighbourhood, intersection, or school is enough)
If they only want a quick answer, still try to get at least their name and confirm their number.

# Complaints and unusual calls
For complaints, refund requests, accidents, or anything unusual or sensitive (including billing disputes, instructor concerns, or legal questions): do not try to solve it or make promises. Apologize sincerely, take a short message with their name and number, and tell them the owner will call them back as soon as possible. Mark the call for the owner.

# Ending the call
Before you hang up, briefly confirm what you collected, then say: "Thanks! Someone from ${school} will call you back shortly to book." Then say goodbye.

# School information

## Office hours (Toronto time)
${formatHours(input.businessHours)}

## Packages and prices (all prices are plus HST)
${packages}

## Frequently asked questions
${faqs}

## Other notes
${input.extraNotes?.trim() || "(none)"}
`;
}

/**
 * The post-call extraction fields to create in Retell
 * (Agent → Post-Call Analysis). Names must match exactly — our webhook reads
 * them from call_analysis.custom_analysis_data.
 */
export const EXTRACTION_FIELDS: { name: string; type: string; description: string }[] = [
  { name: "name", type: "Text", description: "The caller's full name. Leave blank if they didn't give it." },
  {
    name: "phone",
    type: "Text",
    description: "The best callback phone number the caller gave, if different from the number they called from. Otherwise leave blank.",
  },
  {
    name: "licence_level",
    type: "Selector: G1, G2, G, none, unknown",
    description: "The student's current Ontario licence: G1, G2, G (full), none (no licence yet), or unknown if not mentioned.",
  },
  {
    name: "package_interest",
    type: "Text",
    description: "The package or service the caller is interested in, using the school's package name if possible (e.g. 'BDE Full Course - Package 2').",
  },
  { name: "preferred_times", type: "Text", description: "Preferred lesson days and times, e.g. 'Weekday evenings' or 'Saturday mornings'." },
  { name: "pickup_area", type: "Text", description: "Where the student wants to be picked up: neighbourhood, intersection, or school name." },
  {
    name: "questions_asked",
    type: "Text",
    description: "A short list of the questions the caller asked, especially any the assistant couldn't answer.",
  },
  {
    name: "needs_owner",
    type: "Boolean",
    description: "True if the call is a complaint, refund request, accident, or anything unusual that the owner should handle personally. Otherwise false.",
  },
];
