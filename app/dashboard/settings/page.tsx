import { getCurrentSchool } from "@/lib/school";
import { formatPhone } from "@/lib/phone";
import { DAY_KEYS, type BusinessHours, type SchoolInfo } from "@/lib/types";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const { supabase, school } = await getCurrentSchool();
  if (!school) return null;

  const { data } = await supabase.from("school_info").select("*").eq("school_id", school.id).maybeSingle();
  const info = data as SchoolInfo | null;

  // Fill in any missing days so the form always shows all seven.
  const hours: BusinessHours = {};
  for (const day of DAY_KEYS) {
    hours[day] = school.business_hours?.[day] ?? { closed: day === "sun", open: "09:00", close: "17:00" };
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Settings</h1>
      <p className="mb-6 text-sm text-slate-600">
        Your AI assistant answers callers using this information. Keep prices and FAQs up to date.
      </p>
      <SettingsForm
        initial={{
          name: school.name,
          ai_phone_number: formatPhone(school.ai_phone_number),
          admin_phone: formatPhone(school.admin_phone),
          owner_phone: formatPhone(school.owner_phone),
          business_hours: hours,
          packages: (info?.packages ?? []).map((p) => ({ name: p.name, price: String(p.price), details: p.details ?? "" })),
          faqs: info?.faqs ?? [],
          extra_notes: info?.extra_notes ?? "",
        }}
      />
    </div>
  );
}
