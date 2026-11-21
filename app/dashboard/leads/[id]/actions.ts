"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LEAD_STATUSES } from "@/lib/types";

/** Called by the status buttons on the lead page. */
export async function updateLeadStatus(formData: FormData) {
  const leadId = String(formData.get("leadId") ?? "");
  const status = LEAD_STATUSES.find((s) => s === formData.get("status"));
  if (!leadId || !status) return;

  // Uses the logged-in user's client, so RLS only allows leads from their school.
  const supabase = await createClient();
  const { error } = await supabase.from("leads").update({ status }).eq("id", leadId);
  if (error) console.error("Updating lead status failed:", error.message);

  revalidatePath("/dashboard", "layout");
}
