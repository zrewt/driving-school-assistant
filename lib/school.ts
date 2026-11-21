import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { School } from "@/lib/types";

/**
 * Who is logged in, and which school do they belong to?
 * Wrapped in React's cache() so the layout and the page share one lookup
 * per request. If a user belongs to several schools, the first one is used.
 */
export const getCurrentSchool = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null, school: null, role: null, loadError: null };

  const { data: membership, error } = await supabase
    .from("school_users")
    .select("role, school:schools(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // A failed lookup is NOT the same as "no school yet", so report it separately.
  if (error) console.error("Could not load school membership:", error.message);

  const school = (membership?.school ?? null) as unknown as School | null;
  const role = (membership?.role ?? null) as "owner" | "admin" | null;
  return { supabase, user, school, role, loadError: error?.message ?? null };
});
