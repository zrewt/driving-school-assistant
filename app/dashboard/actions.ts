"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CreateSchoolState = { error?: string };

/** Creates a school and links the logged-in user to it as the owner. */
export async function createSchool(_prev: CreateSchoolState, formData: FormData): Promise<CreateSchoolState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Please enter your school's name." };
  if (name.length > 120) return { error: "That name is too long." };

  const supabase = await createClient();
  // create_school() is a database function (see the migration) that creates
  // the school, its info row, and the owner link in one step.
  const { error } = await supabase.rpc("create_school", { p_name: name });
  if (error) {
    console.error("create_school failed:", error.message);
    return { error: "Could not create the school. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/settings");
}
