"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSchool } from "@/lib/school";
import { toE164 } from "@/lib/phone";
import { DAY_KEYS, type BusinessHours, type Faq, type Package } from "@/lib/types";

export type SettingsState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

export interface SettingsPayload {
  name: string;
  ai_phone_number: string;
  admin_phone: string;
  owner_phone: string;
  business_hours: BusinessHours;
  packages: { name: string; price: string; details: string }[];
  faqs: Faq[];
  extra_notes: string;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Saves the settings form. The form sends everything as one JSON field. */
export async function saveSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  let input: SettingsPayload;
  try {
    input = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "Something went wrong reading the form. Please reload and try again." };
  }

  const { supabase, school } = await getCurrentSchool();
  if (!school) return { error: "You're not linked to a school." };

  const fieldErrors: Record<string, string> = {};

  // --- School name
  const name = (input.name ?? "").trim();
  if (!name) fieldErrors.name = "School name is required.";

  // --- Phone numbers: optional, but must be valid. Saved as E.164.
  const phones = {} as Record<"ai_phone_number" | "admin_phone" | "owner_phone", string | null>;
  for (const field of ["ai_phone_number", "admin_phone", "owner_phone"] as const) {
    const raw = (input[field] ?? "").trim();
    if (!raw) {
      phones[field] = null;
      continue;
    }
    const e164 = toE164(raw);
    if (!e164) fieldErrors[field] = "Enter a valid phone number, e.g. 416-555-0123.";
    phones[field] = e164;
  }

  // --- Business hours
  const hours: BusinessHours = {};
  for (const day of DAY_KEYS) {
    const d = input.business_hours?.[day];
    const closed = Boolean(d?.closed);
    const open = d?.open ?? "09:00";
    const close = d?.close ?? "17:00";
    if (!closed && (!TIME.test(open) || !TIME.test(close) || open >= close)) {
      fieldErrors[`hours_${day}`] = "Opening time must be before closing time.";
    }
    hours[day] = { closed, open, close };
  }

  // --- Packages
  const packages: Package[] = [];
  (input.packages ?? []).forEach((p, i) => {
    const pName = (p.name ?? "").trim();
    const details = (p.details ?? "").trim();
    const priceText = String(p.price ?? "").replace(/[$,\s]/g, "");
    if (!pName && !priceText && !details) return; // skip completely empty rows
    const price = Number(priceText);
    if (!pName) fieldErrors[`package_${i}`] = "Each package needs a name.";
    else if (!priceText || !Number.isFinite(price) || price < 0) fieldErrors[`package_${i}`] = "Enter a price, e.g. 745.";
    packages.push({ name: pName, price: Math.round(price * 100) / 100, details });
  });

  // --- FAQs
  const faqs: Faq[] = [];
  (input.faqs ?? []).forEach((f, i) => {
    const question = (f.question ?? "").trim();
    const answer = (f.answer ?? "").trim();
    if (!question && !answer) return;
    if (!question || !answer) fieldErrors[`faq_${i}`] = "Each FAQ needs a question and an answer.";
    faqs.push({ question, answer });
  });

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  // --- Save (RLS allows this only for members of this school)
  const { error: schoolError } = await supabase
    .from("schools")
    .update({ name, ...phones, business_hours: hours })
    .eq("id", school.id);
  if (schoolError) {
    if (schoolError.code === "23505") {
      return { error: "That AI phone number is already used by another school.", fieldErrors: { ai_phone_number: "Already in use." } };
    }
    console.error("Saving school failed:", schoolError.message);
    return { error: "Could not save. Please try again." };
  }

  const { error: infoError } = await supabase
    .from("school_info")
    .upsert(
      { school_id: school.id, packages, faqs, extra_notes: (input.extra_notes ?? "").trim() || null },
      { onConflict: "school_id" },
    );
  if (infoError) {
    console.error("Saving school info failed:", infoError.message);
    return { error: "Could not save packages and FAQs. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
